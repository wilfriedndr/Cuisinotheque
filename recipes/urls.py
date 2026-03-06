"""Public URL routes for the recipes application."""

from django.urls import path
from . import views

urlpatterns = [
    # Core pages.
    path('', views.home, name='home'),
    path('recettes/', views.recipe_list, name='recipe_list'),
    path('recette/<int:pk>/', views.recipe_detail, name='recipe_detail'),
    path('ajouter/', views.recipe_create, name='recipe_create'),
    path('modifier/<int:pk>/', views.recipe_update, name='recipe_update'),
    path('supprimer/<int:pk>/', views.recipe_delete, name='recipe_delete'),

    # Dashboard and data transfer actions (import/export).
    path('dashboard/', views.dashboard, name='dashboard'),
    path('dashboard/import/', views.recipe_import, name='recipe_import'),
    path('dashboard/import/schema/', views.recipe_import_schema, name='recipe_import_schema'),
    path('recette/<int:pk>/export/<str:fmt>/', views.recipe_export, name='recipe_export'),
]
