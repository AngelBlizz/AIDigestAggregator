# Управление процессами AI News Digest Aggregator

Этот файл содержит инструкции по использованию скрипта `manage_processes.py` для управления компонентами бэкенда.

## Установка зависимостей

Перед использованием скрипта необходимо установить библиотеку psutil:

```
pip install psutil
```

## Использование скрипта

Скрипт позволяет запускать, останавливать и перезапускать компоненты системы, а также проверять их статус.

### Проверка статуса всех компонентов

```
python manage_processes.py --status
```

### Запуск компонентов

#### Запуск всех компонентов
```
python manage_processes.py --start all
```

#### Запуск отдельного компонента
```
python manage_processes.py --start api      # Запуск FastAPI сервера
python manage_processes.py --start worker   # Запуск Celery worker
python manage_processes.py --start beat     # Запуск Celery beat
python manage_processes.py --start redis    # Запуск Redis сервера
```

### Остановка компонентов

#### Остановка всех компонентов
```
python manage_processes.py --stop all
```

#### Остановка отдельного компонента
```
python manage_processes.py --stop api       # Остановка FastAPI сервера
python manage_processes.py --stop worker    # Остановка Celery worker
python manage_processes.py --stop beat      # Остановка Celery beat
python manage_processes.py --stop redis     # Остановка Redis сервера
```

### Перезапуск компонентов

#### Перезапуск всех компонентов
```
python manage_processes.py --restart all
```

#### Перезапуск отдельного компонента
```
python manage_processes.py --restart api      # Перезапуск FastAPI сервера
python manage_processes.py --restart worker   # Перезапуск Celery worker
python manage_processes.py --restart beat     # Перезапуск Celery beat
python manage_processes.py --restart redis    # Перезапуск Redis сервера
```

## Решение проблем

### Процессы не останавливаются

Если какой-то процесс не останавливается с помощью скрипта, это может быть связано с правами доступа или другими проблемами. В этом случае можно использовать диспетчер задач или команду kill для принудительного завершения процесса.

#### Windows (через PowerShell или командную строку)
```
# Найти PID процесса
tasklist | findstr "uvicorn"  # или "celery", "redis-server"

# Завершить процесс по PID
taskkill /F /PID <pid>
```

#### Linux/Mac
```
# Найти PID процесса
ps aux | grep "uvicorn"  # или "celery", "redis-server"

# Завершить процесс по PID
kill -9 <pid>
```

### Запуск в обход скрипта

Если скрипт не работает, компоненты можно запустить напрямую:

#### FastAPI сервер
```
cd backend
uvicorn app.main:app --reload
```

#### Celery worker
```
cd backend
celery -A app.core.celery_app worker --loglevel=info
```

#### Celery beat
```
cd backend
celery -A app.core.celery_app beat --loglevel=info
```

#### Redis (если установлен)
```
redis-server
``` 