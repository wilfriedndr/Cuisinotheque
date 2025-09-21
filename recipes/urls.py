from django.urls import path
from . import views

urlpatterns = [
    path('', views.home, name='home'),
    path('recettes/', views.recipe_list, name='recipe_list'),
    path('recette/<int:pk>/', views.recipe_detail, name='recipe_detail'),
    path('ajouter/', views.recipe_create, name='recipe_create'),
    path('modifier/<int:pk>/', views.recipe_update, name='recipe_update'),
    path('supprimer/<int:pk>/', views.recipe_delete, name='recipe_delete'),
    path('dashboard/', views.dashboard, name='dashboard'),
]
