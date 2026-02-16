import json
from decimal import Decimal, InvalidOperation
from django.http import JsonResponse
from django.shortcuts import render
from django.views.decorators.http import require_http_methods

from .models import Recipe, RecipeSection, IngredientItem, Step

def home(request):
    return render(request, "recipes/home.html")

def recipe_list(request):
    return render(request, "recipes/recipe_list.html")

def recipe_detail(request, pk):
    return render(request, "recipes/recipe_detail.html", {"pk": pk})

@require_http_methods(["GET", "POST"])
def recipe_create(request):
    if request.method == "GET":
        return render(request, "recipes/recipe_form.html")

    # --- Champs recipe ---
    title = (request.POST.get("title") or "").strip()
    profile = (request.POST.get("profile") or "").strip()
    description = (request.POST.get("description") or "").strip()

    prep_time = (request.POST.get("prep_time") or "").strip()
    cook_time = (request.POST.get("cook_time") or "").strip()
    rest_time = (request.POST.get("rest_time") or "").strip()

    if not title or not profile:
        return JsonResponse({"ok": False, "error": "Titre et Profil sont obligatoires."}, status=400)

    # --- Payload JSON (sections/ingredients/steps) ---
    payload_raw = request.POST.get("payload") or "{}"
    try:
        payload = json.loads(payload_raw)
    except json.JSONDecodeError:
        return JsonResponse({"ok": False, "error": "Payload JSON invalide."}, status=400)

    sections = payload.get("sections", [])
    if not isinstance(sections, list) or len(sections) == 0:
        return JsonResponse({"ok": False, "error": "Ajoute au moins une section."}, status=400)

    # --- Create ---
    recipe = Recipe.objects.create(
        title=title,
        profile=profile,
        description=description,
        prep_time=prep_time,
        cook_time=cook_time,
        rest_time=rest_time,
    )

    for s_idx, section_data in enumerate(sections, start=1):
        section_title = (
            (section_data.get("title") or section_data.get("name") or "").strip()
            or f"Section {s_idx}"
        )

        section = RecipeSection.objects.create(
            recipe=recipe,
            title=section_title,
            order=s_idx,
        )

        # Ingredients
        ingredients = section_data.get("ingredients", [])
        if isinstance(ingredients, list):
            for i_idx, ing in enumerate(ingredients, start=1):
                ing_name = (ing.get("name") or "").strip()
                if not ing_name:
                    continue

                qty_raw = (ing.get("quantity") or "").strip()
                unit = (ing.get("unit") or "").strip()

                quantity = None
                if qty_raw:
                    try:
                        quantity = Decimal(qty_raw.replace(",", "."))
                    except (InvalidOperation, ValueError):
                        quantity = None

                IngredientItem.objects.create(
                    section=section,
                    name=ing_name,
                    quantity=quantity,
                    unit=unit,
                    order=i_idx,
                )

        # Steps
        steps = section_data.get("steps", [])
        if isinstance(steps, list):
            for st_idx, step in enumerate(steps, start=1):
                instruction = (
                    (step.get("instruction") or step.get("text") or "").strip()
                )
                if not instruction:
                    continue

                step_title = (step.get("title") or "").strip()

                Step.objects.create(
                    section=section,
                    title=step_title,
                    instruction=instruction,
                    order=st_idx,
                )

    return JsonResponse({"ok": True, "recipe_id": recipe.pk})

def recipe_update(request, pk):
    return render(request, "recipes/recipe_form.html", {"pk": pk})

def recipe_delete(request, pk):
    return render(request, "recipes/recipe_confirm_delete.html", {"pk": pk})

def dashboard(request):
    return render(request, "recipes/dashboard.html")
