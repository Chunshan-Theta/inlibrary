from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Boolean, DECIMAL, ARRAY
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class Author(Base):
    __tablename__ = "authors"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True)
    affiliation = Column(String(500))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # 關聯關係
    papers = relationship("PaperAuthor", back_populates="author")

class Venue(Base):
    __tablename__ = "venues"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(500), nullable=False)
    type = Column(String(50), nullable=False)  # 'journal' or 'conference'
    impact_factor = Column(DECIMAL(5,3))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # 關聯關係
    papers = relationship("Paper", back_populates="venue")

class Paper(Base):
    __tablename__ = "papers"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(1000), nullable=False)
    abstract = Column(Text)
    publication_year = Column(Integer, nullable=False)
    doi = Column(String(255), unique=True)
    citation_count = Column(Integer, default=0)
    venue_id = Column(Integer, ForeignKey("venues.id"))
    pdf_file_path = Column(String(500))
    file_size = Column(Integer)
    url = Column(String(1000))  # 論文連結
    keywords = Column(ARRAY(String))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # 關聯關係
    venue = relationship("Venue", back_populates="papers")
    authors = relationship("PaperAuthor", back_populates="paper")
    tags = relationship("PaperTag", back_populates="paper")
    citing_papers = relationship("Citation", foreign_keys="Citation.cited_paper_id", back_populates="cited_paper")
    cited_papers = relationship("Citation", foreign_keys="Citation.citing_paper_id", back_populates="citing_paper")

class PaperAuthor(Base):
    __tablename__ = "paper_authors"
    
    id = Column(Integer, primary_key=True, index=True)
    paper_id = Column(Integer, ForeignKey("papers.id"), nullable=False)
    author_id = Column(Integer, ForeignKey("authors.id"), nullable=False)
    author_order = Column(Integer, nullable=False)
    is_corresponding = Column(Boolean, default=False)
    
    # 關聯關係
    paper = relationship("Paper", back_populates="authors")
    author = relationship("Author", back_populates="papers")

class Tag(Base):
    __tablename__ = "tags"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)
    color = Column(String(7), default='#6B7280')
    
    # 關聯關係
    papers = relationship("PaperTag", back_populates="tag")

class PaperTag(Base):
    __tablename__ = "paper_tags"
    
    id = Column(Integer, primary_key=True, index=True)
    paper_id = Column(Integer, ForeignKey("papers.id"), nullable=False)
    tag_id = Column(Integer, ForeignKey("tags.id"), nullable=False)
    
    # 關聯關係
    paper = relationship("Paper", back_populates="tags")
    tag = relationship("Tag", back_populates="papers")

class Citation(Base):
    __tablename__ = "citations"
    
    id = Column(Integer, primary_key=True, index=True)
    citing_paper_id = Column(Integer, ForeignKey("papers.id"), nullable=False)
    cited_paper_id = Column(Integer, ForeignKey("papers.id"), nullable=False)
    
    # 關聯關係
    citing_paper = relationship("Paper", foreign_keys=[citing_paper_id], back_populates="cited_papers")
    cited_paper = relationship("Paper", foreign_keys=[cited_paper_id], back_populates="citing_papers") 