from sqlalchemy import Column, Integer, String, JSON
from database import Base

class Recipe(Base):
    __tablename__ = 'recipes'
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    ingredients = Column(JSON)
    steps = Column(JSON)
    cooking_time = Column(Integer)
    user_id = Column(Integer)
