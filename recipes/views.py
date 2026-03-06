"""Core views and helpers for recipes CRUD, dashboard, import and export."""

import json
from decimal import Decimal, InvalidOperation
from html import escape
from textwrap import wrap
from django.contrib import messages
from django.db import transaction
from django.db.models import Q
from django.http import HttpResponse, JsonResponse
from django.urls import reverse
from django.shortcuts import render, get_object_or_404, redirect
from django.utils.text import slugify
from django.views.decorators.http import require_http_methods

from .models import Recipe, RecipeSection, IngredientItem, Step


def _clean_text(value):
    """Normalize user-provided text values to a stripped string."""
    return str(value or "").strip()


def _parse_quantity(value):
    """Parse a quantity string into Decimal, accepting comma as decimal separator."""
    raw = _clean_text(value)
    if not raw:
        return None

    try:
        return Decimal(raw.replace(",", "."))
    except (InvalidOperation, ValueError):
        return None


def _build_import_schema():
    """Return the canonical JSON schema shown in the import modal."""
    return {
        "recipes": [
            {
                "title": "",
                "profile": "",
                "description": "",
                "prep_time": "",
                "cook_time": "",
                "rest_time": "",
                "sections": [
                    {
                        "title": "",
                        "ingredients": [
                            {
                                "name": "",
                                "quantity": "",
                                "unit": "",
                            }
                        ],
                        "steps": [
                            {
                                "text": "",
                            }
                        ],
                    }
                ],
            }
        ]
    }


def _iter_import_recipes(payload):
    """Extract a list of recipe objects from accepted JSON payload shapes."""
    if isinstance(payload, dict):
        recipe_items = payload.get("recipes")
        if isinstance(recipe_items, list):
            return recipe_items
        if "title" in payload or "sections" in payload:
            return [payload]
        raise ValueError("Le JSON doit contenir une cle 'recipes' ou une recette unique.")

    if isinstance(payload, list):
        return payload

    raise ValueError("Le JSON doit etre un objet ou une liste de recettes.")


def _create_recipe_sections(recipe, sections):
    """Create sections, ingredients and steps rows for one recipe."""
    created_count = 0

    for section_data in sections:
        if not isinstance(section_data, dict):
            continue

        section_title = _clean_text(
            section_data.get("title") or section_data.get("name")
        ) or f"Section {created_count + 1}"

        section = RecipeSection.objects.create(
            recipe=recipe,
            title=section_title,
            order=created_count + 1,
        )
        created_count += 1

        ingredients = section_data.get("ingredients", [])
        ingredient_order = 0
        if isinstance(ingredients, list):
            for ing in ingredients:
                if not isinstance(ing, dict):
                    continue

                ing_name = _clean_text(ing.get("name"))
                if not ing_name:
                    continue

                ingredient_order += 1
                IngredientItem.objects.create(
                    section=section,
                    name=ing_name,
                    quantity=_parse_quantity(ing.get("quantity")),
                    unit=_clean_text(ing.get("unit")),
                    order=ingredient_order,
                )

        steps = section_data.get("steps", [])
        step_order = 0
        if isinstance(steps, list):
            for step in steps:
                if not isinstance(step, dict):
                    continue

                instruction = _clean_text(step.get("instruction") or step.get("text"))
                if not instruction:
                    continue

                step_order += 1
                Step.objects.create(
                    section=section,
                    title=_clean_text(step.get("title")),
                    instruction=instruction,
                    order=step_order,
                )

    return created_count


def _save_recipe_from_payload(recipe, payload):
    """Create or update a recipe from normalized payload data."""
    title = _clean_text(payload.get("title"))
    profile = _clean_text(payload.get("profile"))
    description = _clean_text(payload.get("description"))
    prep_time = _clean_text(payload.get("prep_time"))
    cook_time = _clean_text(payload.get("cook_time"))
    rest_time = _clean_text(payload.get("rest_time"))
    sections = payload.get("sections", [])

    if not title or not profile:
        raise ValueError("Titre et Profil sont obligatoires.")

    if not isinstance(sections, list) or len(sections) == 0:
        raise ValueError("Ajoute au moins une section.")

    if recipe is None:
        recipe = Recipe.objects.create(
            title=title,
            profile=profile,
            description=description,
            prep_time=prep_time,
            cook_time=cook_time,
            rest_time=rest_time,
        )
    else:
        recipe.title = title
        recipe.profile = profile
        recipe.description = description
        recipe.prep_time = prep_time
        recipe.cook_time = cook_time
        recipe.rest_time = rest_time
        recipe.save()
        RecipeSection.objects.filter(recipe=recipe).delete()

    if _create_recipe_sections(recipe, sections) == 0:
        raise ValueError("Ajoute au moins une section valide.")

    return recipe


def _serialize_recipe(recipe):
    """Serialize one recipe and all related sections for export."""
    sections_qs = (
        RecipeSection.objects.filter(recipe=recipe)
        .prefetch_related("ingredients", "steps")
        .order_by("order", "id")
    )
    sections = []

    for section in sections_qs:
        sections.append(
            {
                "title": section.title or "",
                "ingredients": [
                    {
                        "name": ing.name or "",
                        "quantity": _quantity_to_text(ing.quantity),
                        "unit": ing.unit or "",
                    }
                    for ing in section.ingredients.all()
                ],
                "steps": [
                    {
                        "text": st.instruction or "",
                    }
                    for st in section.steps.all()
                ],
            }
        )

    return {
        "title": recipe.title or "",
        "profile": recipe.profile or "",
        "description": recipe.description or "",
        "prep_time": recipe.prep_time or "",
        "cook_time": recipe.cook_time or "",
        "rest_time": recipe.rest_time or "",
        "sections": sections,
    }


def _pdf_wrap_text(value, width):
    """Wrap text by paragraphs for PDF rendering with manual line breaks."""
    text = (value or "").replace("\r\n", "\n")
    paragraphs = text.split("\n")
    wrapped_lines = []

    for paragraph in paragraphs:
        cleaned = " ".join(paragraph.split())
        if not cleaned:
            wrapped_lines.append("")
            continue

        wrapped_lines.extend(
            wrap(
                cleaned,
                width=width,
                break_long_words=False,
                break_on_hyphens=False,
            )
            or [cleaned]
        )

    return wrapped_lines or [""]


def _pdf_text_hex(value):
    """Encode text to PDF hex string using cp1252/WinAnsi-compatible bytes."""
    encoded = (value or "").encode("cp1252", "replace")
    return f"<{encoded.hex().upper()}>"


def _pdf_append_block(
    items,
    text,
    *,
    font,
    size,
    leading,
    width,
    gap_before=0,
    indent=0,
):
    """Append a styled block (possibly multiline) to the PDF layout queue."""
    lines = _pdf_wrap_text(text, width)
    first_line = True

    for line in lines:
        items.append(
            {
                "text": line,
                "font": font,
                "size": size,
                "leading": leading,
                "gap_before": gap_before if first_line else 0,
                "indent": indent,
            }
        )
        first_line = False


def _build_recipe_pdf(recipe_data):
    """Generate a lightweight multi-page PDF document from serialized recipe data."""
    page_height = 842
    margin_left = 48
    top_y = 796
    bottom_y = 56

    content_items = []

    _pdf_append_block(
        content_items,
        recipe_data.get("title") or "Recette",
        font="F2",
        size=24,
        leading=30,
        width=42,
    )
    _pdf_append_block(
        content_items,
        f"Profil: {recipe_data.get('profile') or 'Non renseigne'}",
        font="F1",
        size=13,
        leading=18,
        width=84,
        gap_before=2,
    )

    time_bits = []
    if recipe_data.get("prep_time"):
        time_bits.append(f"Preparation: {recipe_data['prep_time']}")
    if recipe_data.get("cook_time"):
        time_bits.append(f"Cuisson: {recipe_data['cook_time']}")
    if recipe_data.get("rest_time"):
        time_bits.append(f"Repos: {recipe_data['rest_time']}")
    if time_bits:
        _pdf_append_block(
            content_items,
            " | ".join(time_bits),
            font="F1",
            size=12,
            leading=16,
            width=90,
        )

    _pdf_append_block(
        content_items,
        "Description",
        font="F2",
        size=14,
        leading=20,
        width=90,
        gap_before=12,
    )
    _pdf_append_block(
        content_items,
        recipe_data.get("description") or "Aucune description.",
        font="F1",
        size=12,
        leading=16,
        width=90,
    )

    for section_index, section in enumerate(recipe_data.get("sections", []), start=1):
        section_title = section.get("title") or "Section"
        _pdf_append_block(
            content_items,
            f"Section {section_index}: {section_title}",
            font="F2",
            size=16,
            leading=22,
            width=64,
            gap_before=18,
        )

        _pdf_append_block(
            content_items,
            "Ingredients",
            font="F2",
            size=12,
            leading=16,
            width=90,
            gap_before=4,
        )

        ingredients = section.get("ingredients", [])
        if ingredients:
            for ingredient in ingredients:
                parts = []
                if ingredient.get("quantity"):
                    parts.append(str(ingredient["quantity"]))
                if ingredient.get("unit"):
                    parts.append(str(ingredient["unit"]))
                parts.append(ingredient.get("name") or "Ingredient")

                _pdf_append_block(
                    content_items,
                    f"- {' '.join(parts)}",
                    font="F1",
                    size=11,
                    leading=15,
                    width=92,
                    indent=12,
                )
        else:
            _pdf_append_block(
                content_items,
                "- Aucun ingredient.",
                font="F1",
                size=11,
                leading=15,
                width=92,
                indent=12,
            )

        _pdf_append_block(
            content_items,
            "Etapes",
            font="F2",
            size=12,
            leading=16,
            width=90,
            gap_before=4,
        )

        steps = section.get("steps", [])
        if steps:
            for step_index, step in enumerate(steps, start=1):
                _pdf_append_block(
                    content_items,
                    f"{step_index}. {step.get('text') or 'Etape vide'}",
                    font="F1",
                    size=11,
                    leading=15,
                    width=92,
                    indent=12,
                )
        else:
            _pdf_append_block(
                content_items,
                "- Aucune etape.",
                font="F1",
                size=11,
                leading=15,
                width=92,
                indent=12,
            )

    pages = [[]]
    current_y = top_y

    for item in content_items:
        gap = item.get("gap_before", 0)
        if gap:
            if current_y - gap < bottom_y:
                pages.append([])
                current_y = top_y
            current_y -= gap

        if current_y - item["leading"] < bottom_y:
            pages.append([])
            current_y = top_y

        page_item = item.copy()
        page_item["y"] = current_y
        pages[-1].append(page_item)
        current_y -= item["leading"]

    page_count = len(pages)
    page_number_offset = 5
    page_object_numbers = [page_number_offset + (index * 2) for index in range(page_count)]
    content_object_numbers = [number + 1 for number in page_object_numbers]

    objects = [
        b"",
        b"",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    ]

    for index, page_items in enumerate(pages):
        stream_lines = []

        for entry in page_items:
            text = entry["text"]
            if not text:
                continue

            x = margin_left + entry.get("indent", 0)
            y = entry["y"]
            text_hex = _pdf_text_hex(text)

            stream_lines.extend(
                [
                    "BT",
                    f"/{entry['font']} {entry['size']} Tf",
                    f"1 0 0 1 {x:.2f} {y:.2f} Tm",
                    f"{text_hex} Tj",
                    "ET",
                ]
            )

        footer_text = _pdf_text_hex(f"Page {index + 1} / {page_count}")
        stream_lines.extend(
            [
                "BT",
                "/F1 9 Tf",
                f"1 0 0 1 {margin_left:.2f} 30.00 Tm",
                f"{footer_text} Tj",
                "ET",
            ]
        )

        stream = "\n".join(stream_lines).encode("ascii")

        page_object = (
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 {page_height}] "
            f"/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> "
            f"/Contents {content_object_numbers[index]} 0 R >>"
        ).encode("ascii")
        content_object = (
            f"<< /Length {len(stream)} >>\nstream\n".encode("ascii")
            + stream
            + b"\nendstream"
        )

        objects.append(page_object)
        objects.append(content_object)

    kids = " ".join(f"{number} 0 R" for number in page_object_numbers)
    objects[0] = b"<< /Type /Catalog /Pages 2 0 R >>"
    objects[1] = f"<< /Type /Pages /Count {len(page_object_numbers)} /Kids [{kids}] >>".encode(
        "ascii"
    )

    pdf = b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n"
    offsets = [0]

    for object_number, obj in enumerate(objects, start=1):
        offsets.append(len(pdf))
        pdf += f"{object_number} 0 obj\n".encode("ascii")
        pdf += obj + b"\nendobj\n"

    total_objects = len(objects)
    startxref = len(pdf)
    pdf += f"xref\n0 {total_objects + 1}\n".encode("ascii")
    pdf += b"0000000000 65535 f \n"
    for offset in offsets[1:]:
        pdf += f"{offset:010d} 00000 n \n".encode("ascii")

    pdf += (
        f"trailer\n<< /Size {total_objects + 1} /Root 1 0 R >>\n"
        f"startxref\n{startxref}\n%%EOF"
    ).encode("ascii")

    return pdf


def _build_recipe_word_document(recipe_data):
    """Generate an HTML-based .doc payload readable by Word."""
    def render_text(value):
        return escape(value or "").replace("\n", "<br>")

    html_parts = [
        "<html><head><meta charset='utf-8'>",
        "<style>",
        "body{font-family:Segoe UI,Arial,sans-serif;color:#222;line-height:1.5;}",
        "h1{font-size:28px;margin:0 0 8px;}",
        "h2{font-size:20px;margin:24px 0 8px;}",
        "h3{font-size:16px;margin:14px 0 6px;}",
        ".meta{margin:0 0 16px;color:#555;}",
        ".section{margin-top:18px;padding-top:8px;border-top:1px solid #ddd;}",
        "ul,ol{margin:6px 0 0 20px;}",
        "li{margin:4px 0;}",
        "</style></head><body>",
        f"<h1>{render_text(recipe_data.get('title') or 'Recette')}</h1>",
        f"<p class='meta'><strong>Profil:</strong> {render_text(recipe_data.get('profile') or 'Non renseigne')}</p>",
    ]

    time_bits = []
    if recipe_data.get("prep_time"):
        time_bits.append(f"<strong>Preparation:</strong> {render_text(recipe_data['prep_time'])}")
    if recipe_data.get("cook_time"):
        time_bits.append(f"<strong>Cuisson:</strong> {render_text(recipe_data['cook_time'])}")
    if recipe_data.get("rest_time"):
        time_bits.append(f"<strong>Repos:</strong> {render_text(recipe_data['rest_time'])}")
    if time_bits:
        html_parts.append(f"<p class='meta'>{' | '.join(time_bits)}</p>")

    html_parts.append(
        f"<p>{render_text(recipe_data.get('description') or 'Aucune description.')}</p>"
    )

    for section in recipe_data.get("sections", []):
        html_parts.append("<div class='section'>")
        html_parts.append(
            f"<h2>{render_text(section.get('title') or 'Section')}</h2>"
        )
        html_parts.append("<h3>Ingredients</h3>")
        ingredients = section.get("ingredients", [])
        if ingredients:
            html_parts.append("<ul>")
            for ingredient in ingredients:
                chunk = []
                if ingredient.get("quantity"):
                    chunk.append(render_text(ingredient["quantity"]))
                if ingredient.get("unit"):
                    chunk.append(render_text(ingredient["unit"]))
                chunk.append(render_text(ingredient.get("name") or "Ingredient"))
                html_parts.append(f"<li>{' '.join(chunk)}</li>")
            html_parts.append("</ul>")
        else:
            html_parts.append("<p>Aucun ingredient.</p>")

        html_parts.append("<h3>Etapes</h3>")
        steps = section.get("steps", [])
        if steps:
            html_parts.append("<ol>")
            for step in steps:
                html_parts.append(
                    f"<li>{render_text(step.get('text') or 'Etape vide')}</li>"
                )
            html_parts.append("</ol>")
        else:
            html_parts.append("<p>Aucune etape.</p>")

        html_parts.append("</div>")

    html_parts.append("</body></html>")
    return "".join(html_parts)


def home(request):
    """Render landing page."""
    return render(request, "recipes/home.html")


def recipe_list(request):
    """Render recipes list page with optional title/profile filters."""
    # Filtres saisis depuis la barre de recherche et le select profil
    q = (request.GET.get("q") or "").strip()
    profile = (request.GET.get("profile") or "").strip()

    recipes = Recipe.objects.all()
    # Recherche texte: on matche le titre OU le profil
    if q:
        recipes = recipes.filter(
            Q(title__icontains=q) | Q(profile__icontains=q)
        )
    # Filtre strict sur un profil choisi
    if profile:
        recipes = recipes.filter(profile=profile)

    # Préchargement des relations pour alimenter la pancarte hover
    recipes = recipes.order_by("-id").prefetch_related(
        "sections__ingredients",
        "sections__steps",
    )
    # Options du filtre profil (liste distincte, triée)
    profiles = (
        Recipe.objects.exclude(profile__isnull=True)
        .exclude(profile="")
        .values_list("profile", flat=True)
        .distinct()
        .order_by("profile")
    )

    return render(
        request,
        "recipes/recipe_list.html",
        {
            "recipes": recipes,
            "q": q,
            "profile": profile,
            "profiles": profiles,
        },
    )


def recipe_detail(request, pk):
    """Render a full detail page for one recipe."""
    recipe = get_object_or_404(Recipe, pk=pk)

    sections = (
        RecipeSection.objects.filter(recipe=recipe)
        .prefetch_related("ingredients", "steps")
        .order_by("order", "id")
    )

    return render(
        request,
        "recipes/recipe_detail.html",
        {
            "recipe": recipe,
            "sections": sections,
        },
    )


@require_http_methods(["GET", "POST"])
def recipe_create(request):
    """Create a recipe from form fields + JSON payload sections."""
    if request.method == "GET":
        return render(request, "recipes/recipe_form.html")

    payload_raw = request.POST.get("payload") or "{}"
    try:
        payload = json.loads(payload_raw)
    except json.JSONDecodeError:
        return JsonResponse(
            {"ok": False, "error": "Payload JSON invalide."}, status=400
        )

    recipe_payload = {
        "title": request.POST.get("title"),
        "profile": request.POST.get("profile"),
        "description": request.POST.get("description"),
        "prep_time": request.POST.get("prep_time"),
        "cook_time": request.POST.get("cook_time"),
        "rest_time": request.POST.get("rest_time"),
        "sections": payload.get("sections"),
    }

    try:
        with transaction.atomic():
            recipe = _save_recipe_from_payload(None, recipe_payload)
    except ValueError as exc:
        return JsonResponse({"ok": False, "error": str(exc)}, status=400)

    return redirect("recipe_detail", pk=recipe.pk)


def _quantity_to_text(value):
    """Format Decimal quantity to compact text for UI and export."""
    if value is None:
        return ""
    text = format(value, "f")
    if "." in text:
        text = text.rstrip("0").rstrip(".")
    return text


def _build_initial_payload(recipe):
    """Build update-form initial payload from existing DB rows."""
    sections_qs = (
        RecipeSection.objects.filter(recipe=recipe)
        .prefetch_related("ingredients", "steps")
        .order_by("order", "id")
    )
    payload_sections = []

    for section in sections_qs:
        ingredients = [
            {
                "name": ing.name or "",
                "quantity": _quantity_to_text(ing.quantity),
                "unit": ing.unit or "",
            }
            for ing in section.ingredients.all()
        ]
        steps = [
            {
                "text": st.instruction or "",
            }
            for st in section.steps.all()
        ]

        payload_sections.append(
            {
                "name": section.title or "",
                "ingredients": ingredients,
                "steps": steps,
            }
        )

    return {"sections": payload_sections}


@require_http_methods(["GET", "POST"])
def recipe_update(request, pk):
    """Update an existing recipe from form fields + JSON payload sections."""
    recipe = get_object_or_404(Recipe, pk=pk)

    if request.method == "GET":
        return render(
            request,
            "recipes/recipe_update.html",
            {
                "recipe": recipe,
                "initial_payload": _build_initial_payload(recipe),
            },
        )

    payload_raw = request.POST.get("payload") or "{}"
    try:
        payload = json.loads(payload_raw)
    except json.JSONDecodeError:
        return JsonResponse(
            {"ok": False, "error": "Payload JSON invalide."}, status=400
        )

    recipe_payload = {
        "title": request.POST.get("title"),
        "profile": request.POST.get("profile"),
        "description": request.POST.get("description"),
        "prep_time": request.POST.get("prep_time"),
        "cook_time": request.POST.get("cook_time"),
        "rest_time": request.POST.get("rest_time"),
        "sections": payload.get("sections"),
    }

    try:
        with transaction.atomic():
            _save_recipe_from_payload(recipe, recipe_payload)
    except ValueError as exc:
        return JsonResponse({"ok": False, "error": str(exc)}, status=400)

    return redirect("dashboard")


@require_http_methods(["GET", "POST"])
def recipe_delete(request, pk):
    """Delete a recipe after confirmation."""
    recipe = get_object_or_404(Recipe, pk=pk)

    if request.method == "POST":
        recipe_title = recipe.title or "Recette"
        recipe.delete()
        messages.success(request, f"Recette supprimée avec succès : {recipe_title}.")
        return redirect("dashboard")

    return render(
        request,
        "recipes/recipe_confirm_delete.html",
        {
            "recipe": recipe,
        },
    )


@require_http_methods(["POST"])
def recipe_import(request):
    """Import one or many recipes from posted JSON text/file payload."""
    default_schema_text = json.dumps(
        _build_import_schema(),
        ensure_ascii=False,
        indent=2,
    ).replace("\r\n", "\n").strip()

    payload_raw = (request.POST.get("json_payload") or "").replace("\r\n", "\n").strip()
    upload = request.FILES.get("import_file")
    if upload is not None and (not payload_raw or payload_raw == default_schema_text):
        try:
            payload_raw = upload.read().decode("utf-8-sig")
        except UnicodeDecodeError:
            return JsonResponse(
                {"ok": False, "error": "Le fichier doit etre un JSON UTF-8 valide."},
                status=400,
            )

    if not payload_raw:
        return JsonResponse(
            {"ok": False, "error": "Ajoutez un fichier JSON ou collez un JSON valide."},
            status=400,
        )

    try:
        payload = json.loads(payload_raw)
    except json.JSONDecodeError:
        return JsonResponse({"ok": False, "error": "JSON invalide."}, status=400)

    try:
        recipe_items = _iter_import_recipes(payload)
    except ValueError as exc:
        return JsonResponse({"ok": False, "error": str(exc)}, status=400)

    imported_total = 0
    try:
        with transaction.atomic():
            for idx, recipe_payload in enumerate(recipe_items, start=1):
                if not isinstance(recipe_payload, dict):
                    raise ValueError(f"Recette {idx}: format invalide.")
                try:
                    _save_recipe_from_payload(None, recipe_payload)
                except ValueError as exc:
                    raise ValueError(f"Recette {idx}: {exc}") from exc
                imported_total += 1
    except ValueError as exc:
        return JsonResponse({"ok": False, "error": str(exc)}, status=400)

    if imported_total == 0:
        return JsonResponse(
            {"ok": False, "error": "Aucune recette valide a importer."},
            status=400,
        )

    messages.success(
        request,
        f"{imported_total} recette{'s' if imported_total > 1 else ''} importée{'s' if imported_total > 1 else ''} avec succès.",
    )
    redirect_url = reverse("dashboard")
    return JsonResponse(
        {
            "ok": True,
            "imported": imported_total,
            "redirect_url": redirect_url,
        }
    )


@require_http_methods(["GET"])
def recipe_import_schema(request):
    """Download the JSON schema template used by the import modal."""
    schema_text = json.dumps(
        _build_import_schema(),
        ensure_ascii=False,
        indent=2,
    )
    response = HttpResponse(schema_text, content_type="application/json; charset=utf-8")
    response["Content-Disposition"] = 'attachment; filename="cuisinotheque-import-schema.json"'
    return response


@require_http_methods(["GET"])
def recipe_export(request, pk, fmt):
    """Export one recipe in JSON, Word (.doc) or PDF."""
    recipe = get_object_or_404(Recipe, pk=pk)
    recipe_data = _serialize_recipe(recipe)
    filename_base = slugify(recipe.title) or f"recipe-{recipe.pk}"
    fmt = (fmt or "").lower()

    if fmt == "json":
        payload = json.dumps(
            {"recipes": [recipe_data]},
            ensure_ascii=False,
            indent=2,
        )
        response = HttpResponse(payload, content_type="application/json; charset=utf-8")
        response["Content-Disposition"] = f'attachment; filename="{filename_base}.json"'
        return response

    if fmt == "word":
        response = HttpResponse(
            _build_recipe_word_document(recipe_data),
            content_type="application/msword; charset=utf-8",
        )
        response["Content-Disposition"] = f'attachment; filename="{filename_base}.doc"'
        return response

    if fmt == "pdf":
        response = HttpResponse(
            _build_recipe_pdf(recipe_data),
            content_type="application/pdf",
        )
        response["Content-Disposition"] = f'attachment; filename="{filename_base}.pdf"'
        return response

    return JsonResponse({"ok": False, "error": "Format non supporte."}, status=404)


def dashboard(request):
    """Render dashboard list page with in-page filters and import modal seed data."""
    q = (request.GET.get("q") or "").strip()
    profile = (request.GET.get("profile") or "").strip()

    recipes = Recipe.objects.all()
    if q:
        recipes = recipes.filter(
            Q(title__icontains=q) | Q(profile__icontains=q)
        )
    if profile:
        recipes = recipes.filter(profile=profile)

    recipes = recipes.order_by("-id")
    profiles = (
        Recipe.objects.exclude(profile__isnull=True)
        .exclude(profile="")
        .values_list("profile", flat=True)
        .distinct()
        .order_by("profile")
    )

    return render(
        request,
        "recipes/recipe_dashboard.html",
        {
            "recipes": recipes,
            "q": q,
            "profile": profile,
            "profiles": profiles,
            "import_schema_pretty": json.dumps(
                _build_import_schema(),
                ensure_ascii=False,
                indent=2,
            ),
        },
    )
