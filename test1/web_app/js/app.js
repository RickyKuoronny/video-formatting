// Get references to DOM elements
const searchInput = document.getElementById('search-input');
const dietFilter = document.getElementById('diet-filter');
const sortFilter = document.getElementById('sort-filter');
const searchBtn = document.getElementById('search-btn');
const recipeCards = document.getElementById('recipe-cards');
const recipeDetailSection = document.getElementById('recipe-detail-section');
const recipesSection = document.getElementById('recipes-section');
const recipeDetail = document.getElementById('recipe-detail');
const backBtn = document.getElementById('back-btn');

// Event listeners
searchBtn.addEventListener('click', fetchRecipes);
backBtn.addEventListener('click', () => {
    recipeDetailSection.style.display = 'none';
    recipesSection.style.display = 'block';
});

// Fetch recipes from API based on search/diet/sort
async function fetchRecipes() {
    const query = searchInput.value;
    const diet = dietFilter.value;
    const sort = sortFilter.value;

    let url = `/recipes?search=${encodeURIComponent(query)}`;
    if (diet) url += `&diet=${encodeURIComponent(diet)}`;
    if (sort) url += `&sort=${encodeURIComponent(sort)}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.length === 0) {
            recipeCards.innerHTML = "<p>No recipes found.</p>";
            return;
        }

        renderRecipes(data);
    } catch (err) {
        console.error(err);
        recipeCards.innerHTML = "<p>Error fetching recipes.</p>";
    }
}

// Render recipe cards
function renderRecipes(recipes) {
    recipeCards.innerHTML = '';

    recipes.forEach(recipe => {
        const card = document.createElement('div');
        card.className = 'recipe-card';
        card.innerHTML = `
            <h3>${recipe.title}</h3>
            <img src="${recipe.image_url || '/uploads/images/placeholder.jpg'}" alt="${recipe.title}" width="200">
            <p>Cooking Time: ${recipe.cooking_time} mins</p>
            <button onclick="viewRecipe('${recipe.id}')">View Details</button>
        `;
        recipeCards.appendChild(card);
    });
}

// Fetch and show details for a single recipe
async function viewRecipe(id) {
    try {
        const response = await fetch(`/recipes/${id}`);
        const recipe = await response.json();

        if (recipe.error) {
            recipeDetail.innerHTML = `<p>${recipe.error}</p>`;
            return;
        }

        recipesSection.style.display = 'none';
        recipeDetailSection.style.display = 'block';

        recipeDetail.innerHTML = `
            <h2>${recipe.title}</h2>
            <img src="${recipe.image_url || '/uploads/images/placeholder.jpg'}" alt="${recipe.title}" width="300">
            <h3>Ingredients:</h3>
            <ul>${recipe.ingredients.map(i => `<li>${i}</li>`).join('')}</ul>
            <h3>Steps:</h3>
            <ol>${recipe.steps.map(s => `<li>${s}</li>`).join('')}</ol>
            <h3>Nutrition:</h3>
            <p>Calories: ${recipe.nutrition.calories}</p>
            <p>Protein: ${recipe.nutrition.protein}g</p>
            <p>Fat: ${recipe.nutrition.fat}g</p>
        `;
    } catch (err) {
        console.error(err);
        recipeDetail.innerHTML = "<p>Error fetching recipe details.</p>";
    }
}
