from fastapi import APIRouter, UploadFile, File
from models.recipe import Recipe

router = APIRouter()

@router.get("/recipes")
def get_recipes():
    # Return all recipes (demo)
    return {"recipes": ["Spaghetti", "Pancakes"]}

@router.post("/recipes")
def add_recipe(name: str, file: UploadFile = File(...)):
    # Save recipe or image
    return {"message": f"Recipe {name} uploaded"}

