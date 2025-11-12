/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable jsx-a11y/control-has-associated-label */
import React, { useState, useEffect, useRef } from 'react';
import { UserWarning } from './UserWarning';
import {
  todosService,
  TodosServiceErrors,
  todosServiceErrorText,
  USER_ID,
} from './api/todos';
import cn from 'classnames';
import { TodoItem } from './components/TodoItem';
import { Status } from './types/TodoStatusFilter';
import { getFilteredTodos, Todo } from './types/Todo';
import { useError } from './hooks/useError';
import { TodoCreate } from './types/TodoCreate';
import { TodoList } from './components/TodoList';
import { Header } from './components/TodoHeader';
import { Footer } from './components/TodoFooter';

export const App: React.FC = () => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loadingTodoIds, setLoadingTodoIds] = useState<Todo['id'][]>([]);
  const [selectedStatus, setSelectedStatus] = useState(Status.ALL);
  const [tempTodo, setTempTodo] = useState<Todo | null>(null);

  const { error, handleRemoveError, handleSetError } = useError();

  const todoTitleInputRef = useRef<HTMLInputElement>(null);

  const completedTodos = todos.filter(todo => todo.completed);

  const handleAddTodoToLoading = (todoId: Todo['id']) => {
    setLoadingTodoIds(currentLoading => [...currentLoading, todoId]);
  };

  const handleRemoveTodoFromLoading = (todoId: Todo['id']) => {
    setLoadingTodoIds(currentLoading =>
      currentLoading.filter(id => id !== todoId),
    );
  };

  const getIsTodoLoading = (todoId: Todo['id']) => {
    return loadingTodoIds.includes(todoId);
  };

  const handleToggleStatus = (todoId: Todo['id']) => {
    const todoToToggle = todos.find(todo => todo.id === todoId);

    if (!todoToToggle) {
      return;
    }

    handleAddTodoToLoading(todoId);

    todosService
      .updateTodoStatus(todoId, { completed: !todoToToggle.completed })
      .then(() => {
        setTodos(currentTodos =>
          currentTodos.map(todo =>
            todo.id === todoId ? { ...todo, completed: !todo.completed } : todo,
          ),
        );
      })
      .catch(() => {
        handleSetError(
          todosServiceErrorText[TodosServiceErrors.UNABLE_TO_UPDATE_A_TODO],
        );
      })
      .finally(() => {
        handleRemoveTodoFromLoading(todoId);
      });
  };

  const handleDeleteTodo = (todoId: Todo['id']) => {
    handleAddTodoToLoading(todoId);
    handleRemoveError();

    return todosService
      .deleTodo(todoId)
      .then(() => {
        setTodos(currentTodos =>
          currentTodos.filter(todo => todo.id !== todoId),
        );
      })
      .catch(err => {
        handleSetError(
          todosServiceErrorText[TodosServiceErrors.UNABLE_TO_DELETE_A_TODO],
        );
        throw err;
      })
      .finally(() => {
        handleRemoveTodoFromLoading(todoId);
        if (todoTitleInputRef.current) {
          todoTitleInputRef.current.focus();
        }
      });
  };

  const handleBulkDeleteTodos = (todoIds: Todo['id'][]) => {
    todoIds.forEach(todoId => handleDeleteTodo(todoId));
  };

  const handleDeleteCompleted = () => {
    handleBulkDeleteTodos(completedTodos.map(({ id }) => id));
  };

  const handleAddTodo = async (
    newTodoTitle: string,
    resetTitle: () => void,
  ) => {
    if (!todoTitleInputRef.current) {
      return;
    }

    handleRemoveError();

    const todoCreate: TodoCreate = {
      title: newTodoTitle,
      completed: false,
      userId: USER_ID,
    };

    setTempTodo({
      id: 0,
      ...todoCreate,
    });

    todoTitleInputRef.current.disabled = true;

    try {
      const createdTodo = await todosService.addTodo(todoCreate);

      setTodos(currentTodos => [...currentTodos, createdTodo]);
      resetTitle();
    } catch (err) {
      handleSetError(
        todosServiceErrorText[TodosServiceErrors.UNABLE_TO_ADD_A_TODO],
      );
    } finally {
      setTempTodo(null);
      if (!todoTitleInputRef.current) {
        return;
      }

      todoTitleInputRef.current.disabled = false;
      todoTitleInputRef.current?.focus();
    }
  };

  const allTodosCompleted = todos.every(todo => todo.completed);

  const handleToggleAll = () => {
    const newStatus = !allTodosCompleted;

    todos.forEach(todo => {
      if (todo.completed !== newStatus) {
        handleAddTodoToLoading(todo.id);
        todosService
          .updateTodoStatus(todo.id, { completed: newStatus })
          .then(() => {
            setTodos(currentTodos =>
              currentTodos.map(t =>
                t.id === todo.id ? { ...t, completed: newStatus } : t,
              ),
            );
          })
          .catch(() => {
            handleSetError(
              todosServiceErrorText[TodosServiceErrors.UNABLE_TO_UPDATE_A_TODO],
            );
          })
          .finally(() => {
            handleRemoveTodoFromLoading(todo.id);
          });
      }
    });
  };

  const handleSaveTitle = (todoId: Todo['id'], newTitle: string) => {
    handleAddTodoToLoading(todoId);

    return todosService
      .updateTodoTitle(todoId, newTitle)
      .then(() => {
        setTodos(currentTodos =>
          currentTodos.map(todo =>
            todo.id === todoId ? { ...todo, title: newTitle } : todo,
          ),
        );
      })
      .catch(err => {
        handleSetError(
          todosServiceErrorText[TodosServiceErrors.UNABLE_TO_UPDATE_A_TODO],
        );
        throw err;
      })
      .finally(() => {
        handleRemoveTodoFromLoading(todoId);
      });
  };

  useEffect(() => {
    todosService
      .getTodos()
      .then(setTodos)
      .catch(() => {
        handleSetError(
          todosServiceErrorText[TodosServiceErrors.UNABLE_TO_LOAD_TODOS],
        );
      })
      .finally(() => {});
  }, [handleSetError]);

  const filteredTodos = getFilteredTodos(todos, selectedStatus);

  if (!USER_ID) {
    return <UserWarning />;
  }

  return (
    <div className="todoapp">
      <h1 className="todoapp__title">todos</h1>

      <div className="todoapp__content">
        <Header
          onToggleAll={handleToggleAll}
          allTodosCompleted={allTodosCompleted}
          onAddTodo={handleAddTodo}
          onError={handleSetError}
          todoTitleInputRef={todoTitleInputRef}
          hasTodos={todos.length > 0}
        />

        {filteredTodos.length !== 0 && (
          <TodoList
            todos={filteredTodos}
            isLoading={getIsTodoLoading}
            onDelete={handleDeleteTodo}
            onToggleStatus={handleToggleStatus}
            onSaveTitle={handleSaveTitle}
          />
        )}

        {tempTodo && <TodoItem todo={tempTodo} isLoading />}

        {todos.length !== 0 && (
          <Footer
            todos={todos}
            selectedStatus={selectedStatus}
            setSelectedStatus={setSelectedStatus}
            handleDeleteCompleted={handleDeleteCompleted}
          />
        )}
      </div>

      <div
        data-cy="ErrorNotification"
        className={cn(
          'notification is-danger is-light has-text-weight-normal',
          {
            hidden: !error,
          },
        )}
      >
        <button
          data-cy="HideErrorButton"
          type="button"
          className="delete"
          onClick={handleRemoveError}
        />
        {error}
      </div>
    </div>
  );
};
