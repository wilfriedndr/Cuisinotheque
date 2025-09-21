from django.contrib import admin
from django.urls import path, include
from . import views

urlpatterns = [
    path("admin/", admin.site.urls),
    path("health/", views.health),
    path('', include('recipes.urls')),
]
