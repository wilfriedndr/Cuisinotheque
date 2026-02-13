from django.db import models
from django.core.validators import MinValueValidator


# This Python class defines a Recipe model with fields for title, profile, description, cook time,
# rest time, created and updated timestamps.
class Recipe(models.Model):
    title = models.CharField(max_length=200)
    profile = models.CharField(max_length=80)
    description = models.TextField(blank=True)
    prep_time = models.CharField(max_length=60, blank=True, default="")
    cook_time = models.CharField(max_length=60, blank=True, default="")
    rest_time = models.CharField(max_length=60, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["profile"]),
            models.Index(fields=["title"]),
        ]

    def __str__(self) -> str:
        return self.title


# The `RecipeSection` class represents a component/block of a recipe with attributes such as title,
# order, and a reference to the parent recipe.
class RecipeSection(models.Model):
    """
    Un "composant" / bloc de recette.
    Ex: Génoise, Crème pâtissière, Glaçage, Montage / Assemblage, Décoration...
    """
    recipe = models.ForeignKey(Recipe, on_delete=models.CASCADE, related_name="sections")
    title = models.CharField(max_length=120)
    order = models.PositiveIntegerField(default=1)

    class Meta:
        ordering = ["order", "id"]
        unique_together = [("recipe", "order")]

    def __str__(self) -> str:
        return f"{self.recipe.title} — {self.title}"


# The `IngredientItem` class represents an ingredient attached to a recipe section with attributes for
# name, quantity, unit, note, and order.
class IngredientItem(models.Model):
    """
    Un ingrédient rattaché à une section (RecipeSection).
    """
    section = models.ForeignKey(RecipeSection, on_delete=models.CASCADE, related_name="ingredients")

    name = models.CharField(max_length=160)

    quantity = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(0)],
        help_text="Quantité optionnelle (ex: 200 grammes)"
    )
    unit = models.CharField(
        max_length=30,
        blank=True,
        help_text="Unité optionnelle (g, ml, càs, càc, pincée...)"
    )
    note = models.CharField(
        max_length=180,
        blank=True,
        help_text="Détails optionnels (ex: 'fondu', 'froid', 'à température ambiante')"
    )

    order = models.PositiveIntegerField(default=1)

    class Meta:
        ordering = ["order", "id"]
        unique_together = [("section", "order")]

    def __str__(self) -> str:
        qty = f"{self.quantity:g} " if self.quantity is not None else ""
        unit = f"{self.unit} " if self.unit else ""
        note = f" ({self.note})" if self.note else ""
        return f"{qty}{unit}{self.name}{note}"


# This Python class defines a model for a step related to a component (section) in a recipe, including
# title, instruction, order, duration, and temperature fields.
class Step(models.Model):
    """
    Une étape rattachée à un composant (section).
    Exemple : Section = "Montage"
      - Étape 1: "Couper la génoise en 2 disques"
      - Étape 2: "Garnir avec la crème..."
    """
    section = models.ForeignKey(RecipeSection, on_delete=models.CASCADE, related_name="steps")

    title = models.CharField(max_length=140, blank=True)
    instruction = models.TextField()

    order = models.PositiveIntegerField(default=1)

    duration_min = models.PositiveIntegerField(
        null=True, blank=True, help_text="Durée estimée (min, optionnel)"
    )
    temperature_c = models.PositiveIntegerField(
        null=True, blank=True, help_text="Température (°C, optionnel)"
    )

    class Meta:
        ordering = ["order", "id"]
        unique_together = [("section", "order")]

    def __str__(self) -> str:
        base = f"{self.section.recipe.title} — {self.section.title}"
        return f"{base} — étape {self.order}"
