from sqlalchemy import create_engine, Column, Integer, String, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

DATABASE_URL = "sqlite:///recipes.db"  # or your database URL
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()

class Recipe(Base):
    __tablename__ = "recipes"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String)
    image_url = Column(String)
    cooking_time = Column(Integer)
    ingredients = Column(JSON)
    steps = Column(JSON)
    nutrition = Column(JSON)
    diet = Column(String)

# Create tables
Base.metadata.create_all(engine)
