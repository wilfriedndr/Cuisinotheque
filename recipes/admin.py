from django.contrib import admin
from .models import Recipe, RecipeSection, IngredientItem, Step

admin.site.register(Recipe)
admin.site.register(RecipeSection)
admin.site.register(IngredientItem)
admin.site.register(Step)
