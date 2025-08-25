from flask import Flask, request, jsonify, send_from_directory
from database import SessionLocal, Recipe

app = Flask(__name__, static_folder='web_app', static_url_path='')

# API endpoints
@app.route("/recipes")
def get_recipes():
    search = request.args.get("search", "").lower()
    diet = request.args.get("diet")
    sort = request.args.get("sort")

    db = SessionLocal()
    query = db.query(Recipe)
    
    if search:
        query = query.filter(Recipe.title.ilike(f"%{search}%"))
    
    if diet:
        query = query.filter(Recipe.diet == diet)
    
    if sort == "time":
        query = query.order_by(Recipe.cooking_time)
    
    recipes = query.all()
    db.close()

    # Convert SQLAlchemy objects to dicts
    results = []
    for r in recipes:
        results.append({
            "id": str(r.id),
            "title": r.title,
            "image_url": r.image_url,
            "cooking_time": r.cooking_time,
            "ingredients": r.ingredients,
            "steps": r.steps,
            "nutrition": r.nutrition,
            "diet": r.diet
        })
    return jsonify(results)

@app.route("/recipes/<id>")
def get_recipe_detail(id):
    db = SessionLocal()
    recipe = db.query(Recipe).filter(Recipe.id == id).first()
    db.close()
    if recipe:
        return jsonify({
            "id": str(recipe.id),
            "title": recipe.title,
            "image_url": recipe.image_url,
            "cooking_time": recipe.cooking_time,
            "ingredients": recipe.ingredients,
            "steps": recipe.steps,
            "nutrition": recipe.nutrition,
            "diet": recipe.diet
        })
    return jsonify({"error": "Recipe not found"}), 404

# Serve frontend
@app.route('/')
def serve_index():
    return app.send_static_file('index.html')

@app.route('/uploads/<path:path>')
def serve_uploads(path):
    return send_from_directory('uploads', path)

if __name__ == "__main__":
    app.run(debug=True)
