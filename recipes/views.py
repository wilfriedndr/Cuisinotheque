from django.shortcuts import render

def home(request):
    return render(request, "templates/recipes/home.html")

def recipe_list(request):
    return render(request, "templates/recipes/recipe_list.html")

def recipe_detail(request, pk):
    return render(request, "templates/recipes/recipe_detail.html", {"pk": pk})

def recipe_create(request):
    return render(request, "templates/recipes/recipe_form.html")

def recipe_update(request, pk):
    return render(request, "templates/recipes/recipe_form.html", {"pk": pk})

def recipe_delete(request, pk):
    return render(request, "templates/recipes/recipe_confirm_delete.html", {"pk": pk})

def dashboard(request):
    return render(request, "templates/recipes/dashboard.html")
