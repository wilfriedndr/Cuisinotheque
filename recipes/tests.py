"""
Suite de tests complète pour les vues et modèles de recettes.

Catégories de tests :
- Navigation (home, list, detail, dashboard)
- Création de recettes (avec validation et cas multiples)
- Modification de recettes (avec validation)
- Suppression de recettes
- Import/export de recettes (JSON et PDF)
- Gestion des quantités et formats spéciaux
- Gestion des erreurs et cas limites
"""

import json
from decimal import Decimal
from typing import cast

from django.test import TestCase
from django.urls import reverse

from .models import IngredientItem, Recipe, RecipeSection, Step


class RecipeViewsTests(TestCase):
    """Suite de tests pour les vues et la logique métier des recettes."""

    # ============================================================================
    # HELPERS - Méthodes utilitaires pour les tests
    # ============================================================================

    def build_sections_payload(
        self,
        *,
        section_name="Base",
        ingredient_name="Farine",
        step_text="Melanger."
    ):
        """
        Construit un payload de section minimal pour les tests.
        
        Retourne une liste contenant une section avec :
        - Un ingrédient avec quantité et unité
        - Une étape d'instruction
        """
        return [
            {
                "name": section_name,
                "ingredients": [
                    {
                        "name": ingredient_name,
                        "quantity": "250",
                        "unit": "g",
                    }
                ],
                "steps": [
                    {
                        "text": step_text,
                    }
                ],
            }
        ]

    def create_recipe_with_relations(
        self,
        *,
        title="Tarte citron",
        profile="Dessert"
    ):
        """
        Crée une recette complète avec sections, ingrédients et étapes.
        
        Utile pour les tests qui nécessitent des relations existantes.
        """
        recipe = Recipe.objects.create(
            title=title,
            profile=profile,
            description="Recette test",
            prep_time="20 min",
            cook_time="30 min",
            rest_time="1 h",
        )
        section = RecipeSection.objects.create(recipe=recipe, title="Pate", order=1)
        IngredientItem.objects.create(
            section=section,
            name="Farine",
            quantity=Decimal("250"),
            unit="g",
            order=1,
        )
        Step.objects.create(
            section=section,
            instruction="Melanger les ingredients.",
            order=1,
        )
        return recipe

    # ============================================================================
    # TESTS NAVIGATION - Home, Liste, Détail, Dashboard
    # ============================================================================

    def test_home_page_renders(self):
        """Accueil : Vérifie que la page d'accueil se charge correctement."""
        response = self.client.get(reverse("home"))

        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, "recipes/home.html")

    def test_recipe_list_displays_all_recipes(self):
        """Liste : Affiche toutes les recettes."""
        recipe1 = self.create_recipe_with_relations(title="Cookies", profile="Gouter")
        recipe2 = self.create_recipe_with_relations(title="Tarte", profile="Dessert")

        response = self.client.get(reverse("recipe_list"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Cookies")
        self.assertContains(response, "Tarte")

    def test_recipe_list_filters_by_profile(self):
        """Liste : Filtre les recettes par profil/catégorie."""
        recipe1 = self.create_recipe_with_relations(title="Cookies", profile="Gouter")
        recipe2 = self.create_recipe_with_relations(title="Tiramisu", profile="Dessert")

        response = self.client.get(reverse("recipe_list"), {"profile": "Gouter"})

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Cookies")
        self.assertNotContains(response, "Tiramisu")

    def test_recipe_list_filters_by_search_title(self):
        """Liste : Recherche les recettes par titre."""
        recipe1 = self.create_recipe_with_relations(title="Cookies chocolat", profile="Gouter")
        recipe2 = self.create_recipe_with_relations(title="Tarte citron", profile="Dessert")

        response = self.client.get(reverse("recipe_list"), {"search": "chocolat"})

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Cookies chocolat")
        self.assertNotContains(response, "citron")

    def test_recipe_detail_displays_recipe_and_sections(self):
        """Détail : Affiche la recette avec tous ses détails (sections, ingrédients, étapes)."""
        recipe = self.create_recipe_with_relations()

        response = self.client.get(reverse("recipe_detail", args=[recipe.pk]))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Tarte citron")
        self.assertContains(response, "Pate")
        self.assertContains(response, "Farine")

    def test_recipe_detail_returns_404_for_nonexistent_recipe(self):
        """Détail : Retourne 404 si la recette n'existe pas."""
        response = self.client.get(reverse("recipe_detail", args=[9999]))

        self.assertEqual(response.status_code, 404)

    def test_dashboard_displays_all_recipes(self):
        """Dashboard : Affiche toutes les recettes de l'utilisateur."""
        recipe1 = self.create_recipe_with_relations(title="Cookies", profile="Gouter")
        recipe2 = self.create_recipe_with_relations(title="Tiramisu", profile="Dessert")

        response = self.client.get(reverse("dashboard"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Cookies")
        self.assertContains(response, "Tiramisu")

    # ============================================================================
    # TESTS CRÉATION - Création simple et validation
    # ============================================================================

    def test_recipe_create_creates_nested_records_and_redirects_to_detail(self):
        """
        Création : Crée une recette avec sections, ingrédients et étapes.
        
        Cas nominal : création réussie avec redirection vers la page de détail.
        """
        response = self.client.post(
            reverse("recipe_create"),
            data={
                "title": "Cookies",
                "profile": "Gouter",
                "description": "Classiques",
                "prep_time": "15 min",
                "cook_time": "12 min",
                "rest_time": "",
                "payload": json.dumps(
                    {"sections": self.build_sections_payload(section_name="Pate", ingredient_name="Sucre")}
                ),
            },
        )

        recipe: Recipe = Recipe.objects.get(title="Cookies")
        self.assertRedirects(response, reverse("recipe_detail", args=[recipe.pk]))
        self.assertEqual(recipe.sections.count(), 1)
        section = cast(RecipeSection, recipe.sections.get())
        self.assertEqual(section.ingredients.count(), 1)
        self.assertEqual(section.steps.count(), 1)

    def test_recipe_create_with_missing_title_fails(self):
        """Création : Échoue si le titre est vide."""
        response = self.client.post(
            reverse("recipe_create"),
            data={
                "title": "",
                "profile": "Dessert",
                "description": "Test",
                "prep_time": "10 min",
                "cook_time": "20 min",
                "rest_time": "",
                "payload": json.dumps(
                    {"sections": self.build_sections_payload()}
                ),
            },
        )

        self.assertNotEqual(response.status_code, 302)
        self.assertFalse(Recipe.objects.filter(title="").exists())

    def test_recipe_create_with_missing_profile_fails(self):
        """Création : Échoue si le profil/catégorie est vide."""
        response = self.client.post(
            reverse("recipe_create"),
            data={
                "title": "Test Recipe",
                "profile": "",
                "description": "Test",
                "prep_time": "10 min",
                "cook_time": "20 min",
                "rest_time": "",
                "payload": json.dumps(
                    {"sections": self.build_sections_payload()}
                ),
            },
        )

        self.assertNotEqual(response.status_code, 302)

    def test_recipe_create_with_no_sections_fails(self):
        """Création : Échoue s'il n'y a pas de section."""
        response = self.client.post(
            reverse("recipe_create"),
            data={
                "title": "Test Recipe",
                "profile": "Dessert",
                "description": "Test",
                "prep_time": "10 min",
                "cook_time": "20 min",
                "rest_time": "",
                "payload": json.dumps({"sections": []}),
            },
        )

        self.assertNotEqual(response.status_code, 302)

    def test_recipe_create_with_invalid_json_fails(self):
        """Création : Échoue si le JSON du payload est invalide."""
        response = self.client.post(
            reverse("recipe_create"),
            data={
                "title": "Test Recipe",
                "profile": "Dessert",
                "description": "Test",
                "prep_time": "10 min",
                "cook_time": "20 min",
                "rest_time": "",
                "payload": "not valid json",
            },
        )

        self.assertNotEqual(response.status_code, 302)

    def test_recipe_create_with_multiple_sections_and_items(self):
        """
        Création : Crée une recette avec plusieurs sections.
        
        Chaque section contient plusieurs ingrédients et étapes.
        Teste la gestion complexe des relations imbriquées.
        """
        payload = [
            {
                "name": "Pate",
                "ingredients": [
                    {"name": "Farine", "quantity": "250", "unit": "g"},
                    {"name": "Sucre", "quantity": "100", "unit": "g"},
                    {"name": "Oeufs", "quantity": "2", "unit": ""},
                ],
                "steps": [
                    {"text": "Melanger les ingredients."},
                    {"text": "Cuire au four."},
                ],
            },
            {
                "name": "Glaçage",
                "ingredients": [
                    {"name": "Chocolat", "quantity": "200", "unit": "g"},
                    {"name": "Beurre", "quantity": "50", "unit": "g"},
                ],
                "steps": [
                    {"text": "Faire fondre."},
                    {"text": "Verser sur la pate."},
                ],
            },
        ]

        response = self.client.post(
            reverse("recipe_create"),
            data={
                "title": "Gateau Chocolat",
                "profile": "Dessert",
                "description": "Delicieux",
                "prep_time": "20 min",
                "cook_time": "30 min",
                "rest_time": "1 h",
                "payload": json.dumps({"sections": payload}),
            },
        )

        recipe = Recipe.objects.get(title="Gateau Chocolat")
        self.assertEqual(recipe.sections.count(), 2)
        
        section_pate = recipe.sections.get(title="Pate")
        self.assertEqual(section_pate.ingredients.count(), 3)
        self.assertEqual(section_pate.steps.count(), 2)
        
        section_glacage = recipe.sections.get(title="Glaçage")
        self.assertEqual(section_glacage.ingredients.count(), 2)
        self.assertEqual(section_glacage.steps.count(), 2)

    # ============================================================================
    # TESTS MODIFICATION - Mise à jour et validation
    # ============================================================================

    def test_recipe_update_replaces_existing_sections_and_redirects_to_dashboard(self):
        """
        Modification : Met à jour une recette existante.
        
        Vérifie que :
        - Les détails de la recette sont modifiés
        - Les sections/ingrédients/étapes sont remplacés
        - Redirection vers le dashboard
        """
        recipe = self.create_recipe_with_relations()

        response = self.client.post(
            reverse("recipe_update", args=[recipe.pk]),
            data={
                "title": "Tarte citron meringuee",
                "profile": "Dessert",
                "description": "Version mise a jour",
                "prep_time": "25 min",
                "cook_time": "35 min",
                "rest_time": "2 h",
                "payload": json.dumps(
                    {
                        "sections": self.build_sections_payload(
                            section_name="Meringue",
                            ingredient_name="Sucre glace",
                            step_text="Monter puis pocher.",
                        )
                    }
                ),
            },
        )

        recipe.refresh_from_db()
        self.assertRedirects(response, reverse("dashboard"))
        self.assertEqual(recipe.title, "Tarte citron meringuee")
        self.assertEqual(RecipeSection.objects.filter(recipe=recipe).count(), 1)
        section = cast(RecipeSection, recipe.sections.get())
        self.assertEqual(section.title, "Meringue")
        ingredient = cast(IngredientItem, section.ingredients.get())
        self.assertEqual(ingredient.name, "Sucre glace")
        step = cast(Step, section.steps.get())
        self.assertEqual(step.instruction, "Monter puis pocher.")

    def test_recipe_update_with_missing_title_fails(self):
        """Modification : Échoue si le titre devient vide."""
        recipe = self.create_recipe_with_relations()

        response = self.client.post(
            reverse("recipe_update", args=[recipe.pk]),
            data={
                "title": "",
                "profile": "Dessert",
                "description": "Test",
                "prep_time": "10 min",
                "cook_time": "20 min",
                "rest_time": "",
                "payload": json.dumps(
                    {"sections": self.build_sections_payload()}
                ),
            },
        )

        recipe.refresh_from_db()
        self.assertNotEqual(recipe.title, "")

    def test_recipe_update_nonexistent_returns_404(self):
        """Modification : Retourne 404 si la recette n'existe pas."""
        response = self.client.post(
            reverse("recipe_update", args=[9999]),
            data={
                "title": "New Title",
                "profile": "Dessert",
                "description": "Test",
                "prep_time": "10 min",
                "cook_time": "20 min",
                "rest_time": "",
                "payload": json.dumps(
                    {"sections": self.build_sections_payload()}
                ),
            },
        )

        self.assertEqual(response.status_code, 404)

    # ============================================================================
    # TESTS SUPPRESSION
    # ============================================================================

    def test_recipe_delete_removes_recipe_and_redirects_to_dashboard(self):
        """Suppression : Supprime la recette et redirige vers le dashboard."""
        recipe = self.create_recipe_with_relations()

        response = self.client.post(reverse("recipe_delete", args=[recipe.pk]))

        self.assertRedirects(response, reverse("dashboard"))
        self.assertFalse(Recipe.objects.filter(pk=recipe.pk).exists())

    def test_recipe_delete_nonexistent_returns_404(self):
        """Suppression : Retourne 404 si la recette n'existe pas."""
        response = self.client.post(reverse("recipe_delete", args=[9999]))

        self.assertEqual(response.status_code, 404)

    # ============================================================================
    # TESTS EXPORT - JSON et PDF
    # ============================================================================

    def test_recipe_export_json_returns_serialized_recipe(self):
        """
        Export JSON : Sérialise la recette au format JSON.
        
        Vérifie que le fichier contient :
        - Les informations de la recette
        - Les sections, ingrédients et étapes
        """
        recipe = self.create_recipe_with_relations()

        response = self.client.get(reverse("recipe_export", args=[recipe.pk, "json"]))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/json; charset=utf-8")
        self.assertIn(".json", response["Content-Disposition"])
        payload = json.loads(response.content)
        self.assertEqual(payload["recipes"][0]["title"], "Tarte citron")
        self.assertEqual(payload["recipes"][0]["sections"][0]["ingredients"][0]["name"], "Farine")

    def test_recipe_export_pdf_returns_pdf_file(self):
        """
        Export PDF : Génère un fichier PDF de la recette.
        
        Vérifie le type MIME et la disposition du fichier.
        """
        recipe = self.create_recipe_with_relations()

        response = self.client.get(reverse("recipe_export", args=[recipe.pk, "pdf"]))

        self.assertEqual(response.status_code, 200)
        self.assertIn("application/pdf", response["Content-Type"])
        self.assertIn(".pdf", response["Content-Disposition"])

    def test_recipe_export_returns_404_for_nonexistent_recipe(self):
        """Export : Retourne 404 si la recette n'existe pas."""
        response = self.client.get(reverse("recipe_export", args=[9999, "json"]))

        self.assertEqual(response.status_code, 404)

    def test_recipe_export_invalid_format_returns_404(self):
        """Export : Retourne 404 pour un format non supporté."""
        recipe = self.create_recipe_with_relations()

        response = self.client.get(reverse("recipe_export", args=[recipe.pk, "xml"]))

        self.assertEqual(response.status_code, 404)

    # ============================================================================
    # TESTS IMPORT - Import JSON simple et multiple
    # ============================================================================

    def test_recipe_import_creates_recipe_and_returns_redirect_url(self):
        """
        Import : Crée une recette depuis un JSON.
        
        Cas minimal avec une recette, une section, un ingrédient et une étape.
        """
        response = self.client.post(
            reverse("recipe_import"),
            data={
                "json_payload": json.dumps(
                    {
                        "recipes": [
                            {
                                "title": "Brownie",
                                "profile": "Dessert",
                                "description": "Chocolat",
                                "prep_time": "10 min",
                                "cook_time": "25 min",
                                "rest_time": "",
                                "sections": [
                                    {
                                        "title": "Appareil",
                                        "ingredients": [
                                            {"name": "Chocolat", "quantity": "200", "unit": "g"}
                                        ],
                                        "steps": [{"text": "Faire fondre."}],
                                    }
                                ],
                            }
                        ]
                    }
                )
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertJSONEqual(
            response.content,
            {
                "ok": True,
                "imported": 1,
                "redirect_url": reverse("dashboard"),
            },
        )
        self.assertTrue(Recipe.objects.filter(title="Brownie").exists())

    def test_recipe_import_multiple_recipes(self):
        """
        Import : Importe plusieurs recettes en une seule requête.
        
        Vérifie que le compteur indique le nombre correct de recettes importées.
        """
        payload = {
            "recipes": [
                {
                    "title": "Brownie",
                    "profile": "Dessert",
                    "description": "Chocolat",
                    "prep_time": "10 min",
                    "cook_time": "25 min",
                    "rest_time": "",
                    "sections": [
                        {
                            "title": "Appareil",
                            "ingredients": [{"name": "Chocolat", "quantity": "200", "unit": "g"}],
                            "steps": [{"text": "Faire fondre."}],
                        }
                    ],
                },
                {
                    "title": "Cookies",
                    "profile": "Gouter",
                    "description": "Sucre",
                    "prep_time": "15 min",
                    "cook_time": "12 min",
                    "rest_time": "",
                    "sections": [
                        {
                            "title": "Pate",
                            "ingredients": [{"name": "Farine", "quantity": "250", "unit": "g"}],
                            "steps": [{"text": "Melanger."}],
                        }
                    ],
                },
            ]
        }

        response = self.client.post(
            reverse("recipe_import"),
            data={"json_payload": json.dumps(payload)},
        )

        self.assertEqual(response.status_code, 200)
        payload_response = json.loads(response.content)
        self.assertEqual(payload_response["imported"], 2)
        self.assertTrue(Recipe.objects.filter(title="Brownie").exists())
        self.assertTrue(Recipe.objects.filter(title="Cookies").exists())

    def test_recipe_import_with_invalid_json_fails(self):
        """Import : Échoue avec un JSON invalide."""
        response = self.client.post(
            reverse("recipe_import"),
            data={"json_payload": "not valid json"},
        )

        self.assertEqual(response.status_code, 400)

    def test_recipe_import_with_empty_payload_fails(self):
        """Import : Échoue si le payload est vide ou n'a pas de recettes."""
        response = self.client.post(
            reverse("recipe_import"),
            data={"json_payload": "{}"},
        )

        self.assertEqual(response.status_code, 400)

    def test_recipe_import_skips_invalid_items(self):
        """
        Import : Importe les recettes valides et ignore les invalides.
        
        Cas où un payload contient une recette valide et une invalide
        (titre vide, sans sections). Seule la valide doit être importée.
        """
        payload = {
            "recipes": [
                {
                    "title": "Valid Recipe",
                    "profile": "Dessert",
                    "description": "OK",
                    "prep_time": "10 min",
                    "cook_time": "20 min",
                    "rest_time": "",
                    "sections": [
                        {
                            "title": "Section",
                            "ingredients": [{"name": "Ingredient", "quantity": "100", "unit": "g"}],
                            "steps": [{"text": "Step."}],
                        }
                    ],
                },
                {
                    "title": "",
                    "profile": "Dessert",
                    "description": "Invalid - no title",
                    "prep_time": "",
                    "cook_time": "",
                    "rest_time": "",
                    "sections": [],
                },
            ]
        }

        response = self.client.post(
            reverse("recipe_import"),
            data={"json_payload": json.dumps(payload)},
        )

        self.assertEqual(response.status_code, 200)
        payload_response = json.loads(response.content)
        self.assertEqual(payload_response["imported"], 1)
        self.assertTrue(Recipe.objects.filter(title="Valid Recipe").exists())

    def test_recipe_import_schema_returns_json_schema(self):
        """
        Schéma : Retourne le schéma JSON attendu pour les imports.
        
        Permet aux clients (frontend) de connaître la structure
        requise pour un import valide.
        """
        response = self.client.get(reverse("recipe_import_schema"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/json")
        payload = json.loads(response.content)
        self.assertIn("recipes", payload)

    # ============================================================================
    # TESTS PARSING - Gestion des quantités et formats spéciaux
    # ============================================================================

    def test_recipe_create_with_comma_decimal_quantity(self):
        """
        Quantités : Accepte la virgule comme séparateur décimal.
        
        Les utilisateurs français utilisent "250,5" au lieu de "250.5".
        Le système doit convertir automatiquement.
        """
        payload = [
            {
                "name": "Section",
                "ingredients": [
                    {"name": "Ingredient", "quantity": "250,5", "unit": "g"},
                ],
                "steps": [{"text": "Step."}],
            }
        ]

        response = self.client.post(
            reverse("recipe_create"),
            data={
                "title": "Recipe with Decimal",
                "profile": "Dessert",
                "description": "Test",
                "prep_time": "10 min",
                "cook_time": "20 min",
                "rest_time": "",
                "payload": json.dumps({"sections": payload}),
            },
        )

        recipe = Recipe.objects.get(title="Recipe with Decimal")
        ingredient = cast(IngredientItem, recipe.sections.get().ingredients.get())
        self.assertEqual(ingredient.quantity, Decimal("250.5"))

    def test_recipe_create_with_invalid_quantity_stores_null(self):
        """
        Quantités : Les quantités invalides sont stockées comme NULL.
        
        Si l'utilisateur entre "invalid", le champ quantity reste vide
        au lieu de lever une erreur.
        """
        payload = [
            {
                "name": "Section",
                "ingredients": [
                    {"name": "Ingredient", "quantity": "invalid", "unit": "g"},
                ],
                "steps": [{"text": "Step."}],
            }
        ]

        response = self.client.post(
            reverse("recipe_create"),
            data={
                "title": "Recipe Invalid Qty",
                "profile": "Dessert",
                "description": "Test",
                "prep_time": "10 min",
                "cook_time": "20 min",
                "rest_time": "",
                "payload": json.dumps({"sections": payload}),
            },
        )

        recipe = Recipe.objects.get(title="Recipe Invalid Qty")
        ingredient = cast(IngredientItem, recipe.sections.get().ingredients.get())
        self.assertIsNone(ingredient.quantity)
