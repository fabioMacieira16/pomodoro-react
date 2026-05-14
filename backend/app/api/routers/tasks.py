from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app import dtos
from appdata.database import get_db
from appdata.repositories import task_repo
from appdependencies import get_current_user
from appdomain.models import User

router = APIRouter(prefix="/tasks", tags=["tasks"])

@router.post("/", response_model=dtos.TaskResponse)
def create_task(task_in: dtos.TaskCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    task_data = task_in.model_dump()
    task_data["user_id"] = current_user.id
    return task_repo.create(db, task_data)

@router.get("/", response_model=list[dtos.TaskResponse])
def get_tasks(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return task_repo.get_by_user(db, current_user.id)

@router.put("/{task_id}", response_model=dtos.TaskResponse)
def update_task(task_id: int, task_in: dtos.TaskUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    task = task_repo.get(db, task_id)
    if not task or task.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Task not found")
    
    update_data = task_in.model_dump(exclude_unset=True)
    return task_repo.update(db, task, update_data)

@router.delete("/{task_id}")
def delete_task(task_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    task = task_repo.get(db, task_id)
    if not task or task.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Task not found")
    task_repo.delete(db, task_id)
    return {"message": "Task deleted"}
