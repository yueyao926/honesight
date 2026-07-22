from pydantic import BaseModel, Field
class SearchQuery(BaseModel): q: str = Field(min_length=1,max_length=120)
