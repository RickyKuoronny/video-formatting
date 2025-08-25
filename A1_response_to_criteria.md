# Assignment 1 - REST API Project - Response to Criteria

## Overview
------------------------------------------------

- **Name:** Ricky Kuoronny
- **Student number:** n10666630
- **Application name:** AI-Powered Recipe Finder  
- **Two line description:** A web platform where users can search, upload, and analyze recipes. The app provides nutritional analysis, ingredient substitutions, and recipe suggestions using AI.  

## Core criteria
------------------------------------------------

### Containerise the app

- **ECR Repository name:** recipe-finder-app  
- **Video timestamp:** [Insert timestamp of Docker build]  
- **Relevant files:**  
  - Dockerfile  
  - requirements.txt / package.json  

### Deploy the container

- **EC2 instance ID:** [Insert EC2 ID]  
- **Video timestamp:** [Insert timestamp of deployment]  

### User login

- **One line description:** JWT-based user authentication for saving favorites and uploading recipes.  
- **Video timestamp:** [Insert timestamp]  
- **Relevant files:**  
  - auth.py / auth.js  
  - models/user.py  

### REST API

- **One line description:** Endpoints for uploading, searching, analyzing, and retrieving recipes.  
- **Video timestamp:** [Insert timestamp]  
- **Relevant files:**  
  - routes/recipes.py  
  - app.py  

### Data types

- **One line description:** Handles both structured recipe data and unstructured recipe text/images.  
- **Video timestamp:** [Insert timestamp]  
- **Relevant files:**  
  - models/recipe.py  
  - utils/parser.py  

#### First kind

- **One line description:** Recipe metadata (ingredients, steps, cooking time, user ID, ratings).  
- **Type:** Structured  
- **Rationale:** Allows efficient querying and filtering by user or ingredient.  
- **Video timestamp:** [Insert timestamp]  
- **Relevant files:**  
  - models/recipe.py  

#### Second kind

- **One line description:** Uploaded recipe text or images.  
- **Type:** Unstructured  
- **Rationale:** Users can upload recipes in various formats for AI analysis.  
- **Video timestamp:** [Insert timestamp]  
- **Relevant files:**  
  - utils/parser.py  
  - uploads/  

### CPU intensive task

- **One line description:** Nutritional analysis and AI-powered ingredient substitution for recipes.  
- **Video timestamp:** [Insert timestamp]  
- **Relevant files:**  
  - utils/analyze.py  
  - ai/substitutions.py  

### CPU load testing

- **One line description:** Simulate multiple concurrent recipe searches and analyses to test server load.  
- **Video timestamp:** [Insert timestamp]  
- **Relevant files:**  
  - tests/load_test.py  

## Additional criteria
------------------------------------------------

### Extensive REST API features

- **One line description:** Pagination, filtering by ingredient or dietary restrictions, sorting by cooking time or popularity.  
- **Video timestamp:** [Insert timestamp]  
- **Relevant files:**  
  - routes/recipes.py  

### External API(s)

- **One line description:** Integration with Spoonacular API for expanded recipe search and nutritional data.  
- **Video timestamp:** [Insert timestamp]  
- **Relevant files:**  
  - external/spoonacular.py  

### Additional types of data

- **One line description:** Recipe images and analyzed nutritional data in JSON format.  
- **Video timestamp:** [Insert timestamp]  
- **Relevant files:**  
  - uploads/images/  
  - models/nutrition.py  

### Web client

- **One line description:** A web interface allowing users to search recipes, filter by ingredients or dietary restrictions, view nutritional info, and receive AI-based suggestions.  
- **Video timestamp:** [Insert timestamp]  
- **Relevant files:**  
  - web_app/index.html  
  - web_app/js/app.js  
  - web_app/css/styles.css  

### Custom processing

- **One line description:** Not attempted  
- **Video timestamp:**  
- **Relevant files:**  
  -  

### Infrastructure as code

- **One line description:** Not attempted  
- **Video timestamp:**  
- **Relevant files:**  
  -  

### Upon request

- **One line description:** Not attempted  
- **Video timestamp:**  
- **Relevant files:**  
  -  

