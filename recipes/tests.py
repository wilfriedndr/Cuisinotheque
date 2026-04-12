import json
from decimal import Decimal

from django.test import TestCase
from django.urls import reverse

from .models import IngredientItem, Recipe, RecipeSection, Step


class RecipeViewsTests(TestCase):
    def build_sections_payload(self, *, section_name="Base", ingredient_name="Farine", step_text="Melanger."):
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

    def create_recipe_with_relations(self, *, title="Tarte citron", profile="Dessert"):
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

    def test_home_page_renders(self):
        response = self.client.get(reverse("home"))

        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, "recipes/home.html")

    def test_recipe_create_creates_nested_records_and_redirects_to_detail(self):
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

        recipe = Recipe.objects.get(title="Cookies")
        self.assertRedirects(response, reverse("recipe_detail", args=[recipe.pk]))
        self.assertEqual(recipe.sections.count(), 1)
        self.assertEqual(recipe.sections.get().ingredients.count(), 1)
        self.assertEqual(recipe.sections.get().steps.count(), 1)

    def test_recipe_update_replaces_existing_sections_and_redirects_to_dashboard(self):
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
        section = recipe.sections.get()
        self.assertEqual(section.title, "Meringue")
        self.assertEqual(section.ingredients.get().name, "Sucre glace")
        self.assertEqual(section.steps.get().instruction, "Monter puis pocher.")

    def test_recipe_import_creates_recipe_and_returns_redirect_url(self):
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

    def test_recipe_export_json_returns_serialized_recipe(self):
        recipe = self.create_recipe_with_relations()

        response = self.client.get(reverse("recipe_export", args=[recipe.pk, "json"]))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/json; charset=utf-8")
        self.assertIn(".json", response["Content-Disposition"])
        payload = json.loads(response.content)
        self.assertEqual(payload["recipes"][0]["title"], "Tarte citron")
        self.assertEqual(payload["recipes"][0]["sections"][0]["ingredients"][0]["name"], "Farine")

    def test_recipe_delete_removes_recipe_and_redirects_to_dashboard(self):
        recipe = self.create_recipe_with_relations()

        response = self.client.post(reverse("recipe_delete", args=[recipe.pk]))

        self.assertRedirects(response, reverse("dashboard"))
        self.assertFalse(Recipe.objects.filter(pk=recipe.pk).exists())
