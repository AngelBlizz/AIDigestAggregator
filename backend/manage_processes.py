#!/usr/bin/env python3
"""
Скрипт для управления процессами бэкенда AI News Digest Aggregator
"""

import os
import sys
import subprocess
import signal
import time
import psutil
import argparse
from typing import List, Optional

# Определение процессов
PROCESSES = {
    "api": {
        "command": "uvicorn app.main:app --reload",
        "name": "uvicorn",
        "description": "FastAPI веб-сервер"
    },
    "worker": {
        "command": "celery -A app.core.celery_app worker --loglevel=info",
        "name": "celery",
        "description": "Celery worker для фоновых задач"
    },
    "beat": {
        "command": "celery -A app.core.celery_app beat --loglevel=info",
        "name": "celery",
        "description": "Celery beat планировщик задач"
    },
    "redis": {
        "command": "redis-server",
        "name": "redis-server",
        "description": "Redis сервер для кэширования и очередей"
    }
}

def find_process_by_name(name: str) -> List[psutil.Process]:
    """Находит процессы по имени"""
    result = []
    for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
        try:
            # Проверяем, содержит ли командная строка нужное имя
            if proc.info['name'] and name in proc.info['name'].lower():
                result.append(proc)
            elif proc.info['cmdline'] and any(name in cmd.lower() for cmd in proc.info['cmdline']):
                result.append(proc)
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            pass
    return result

def kill_process(process: psutil.Process) -> bool:
    """Останавливает процесс и все его дочерние процессы"""
    print(f"Останавливаем процесс: {process.pid} ({' '.join(process.cmdline())})")
    try:
        # Получаем дочерние процессы
        children = process.children(recursive=True)
        
        # Отправляем SIGTERM процессу
        process.terminate()
        
        # Даем время на корректное завершение
        gone, still_alive = psutil.wait_procs([process], timeout=3)
        
        # Если процесс все еще жив, используем SIGKILL
        if still_alive:
            for p in still_alive:
                print(f"Процесс {p.pid} не завершился, применяем SIGKILL")
                p.kill()
        
        # Завершаем дочерние процессы
        for child in children:
            try:
                child.terminate()
                gone, still_alive = psutil.wait_procs([child], timeout=3)
                if still_alive:
                    for p in still_alive:
                        p.kill()
            except psutil.NoSuchProcess:
                pass
        
        return True
    except Exception as e:
        print(f"Ошибка при остановке процесса {process.pid}: {str(e)}")
        return False

def start_process(process_key: str) -> Optional[subprocess.Popen]:
    """Запускает процесс"""
    if process_key not in PROCESSES:
        print(f"Ошибка: Неизвестный процесс '{process_key}'")
        return None
    
    # Проверяем, не запущен ли уже
    if is_process_running(process_key):
        print(f"Процесс '{process_key}' уже запущен")
        return None
    
    process_info = PROCESSES[process_key]
    print(f"Запускаем {process_info['description']} ({process_key})...")
    
    try:
        # Создаем новый терминал для процесса (для Windows)
        if os.name == 'nt':
            process = subprocess.Popen(
                f"start cmd /K {process_info['command']}",
                shell=True
            )
        else:
            # Для Linux/Mac открываем новый терминал
            if sys.platform == 'darwin':  # MacOS
                process = subprocess.Popen(
                    ["osascript", "-e", f'tell app "Terminal" to do script "{process_info["command"]}"']
                )
            else:  # Linux
                process = subprocess.Popen(
                    ["gnome-terminal", "--", "bash", "-c", f"{process_info['command']}; read -p 'Нажмите Enter для закрытия'"],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE
                )
        
        print(f"Процесс '{process_key}' запущен")
        return process
    except Exception as e:
        print(f"Ошибка при запуске процесса '{process_key}': {str(e)}")
        return None

def stop_process(process_key: str) -> bool:
    """Останавливает процесс"""
    if process_key not in PROCESSES:
        print(f"Ошибка: Неизвестный процесс '{process_key}'")
        return False
    
    process_info = PROCESSES[process_key]
    processes = find_process_by_name(process_info['name'])
    
    if not processes:
        print(f"Процесс '{process_key}' не запущен")
        return True
    
    success = True
    for proc in processes:
        try:
            # Проверяем, соответствует ли процесс нашему приложению
            if process_key == 'api' and 'app.main:app' not in ' '.join(proc.cmdline()):
                continue
            if process_key == 'worker' and 'worker' not in ' '.join(proc.cmdline()):
                continue
            if process_key == 'beat' and 'beat' not in ' '.join(proc.cmdline()):
                continue
            
            if not kill_process(proc):
                success = False
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass
    
    return success

def is_process_running(process_key: str) -> bool:
    """Проверяет, запущен ли процесс"""
    if process_key not in PROCESSES:
        return False
    
    process_info = PROCESSES[process_key]
    processes = find_process_by_name(process_info['name'])
    
    if not processes:
        return False
    
    for proc in processes:
        try:
            # Проверяем, соответствует ли процесс нашему приложению
            cmdline = ' '.join(proc.cmdline())
            if process_key == 'api' and 'app.main:app' in cmdline:
                return True
            if process_key == 'worker' and 'worker' in cmdline:
                return True
            if process_key == 'beat' and 'beat' in cmdline:
                return True
            if process_key == 'redis' and process_info['name'] in cmdline:
                return True
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass
    
    return False

def start_all():
    """Запускает все процессы"""
    print("Запуск всех компонентов системы...")
    
    # Запускаем Redis первым
    if 'redis' in PROCESSES:
        start_process('redis')
        time.sleep(2)  # Даем Redis время на запуск
    
    # Запускаем API
    start_process('api')
    time.sleep(1)
    
    # Запускаем Celery worker
    start_process('worker')
    time.sleep(1)
    
    # Запускаем Celery beat
    start_process('beat')
    
    print("Все компоненты запущены")

def stop_all():
    """Останавливает все процессы"""
    print("Остановка всех компонентов системы...")
    
    # Останавливаем в обратном порядке
    stop_process('beat')
    stop_process('worker')
    stop_process('api')
    
    # Redis останавливаем последним
    if 'redis' in PROCESSES:
        stop_process('redis')
    
    print("Все компоненты остановлены")

def list_running():
    """Выводит список запущенных процессов"""
    print("\nСтатус процессов:")
    print("=" * 50)
    for key, info in PROCESSES.items():
        status = "Запущен" if is_process_running(key) else "Остановлен"
        print(f"{key:<10} | {info['description']:<30} | {status}")
    print("=" * 50)

def main():
    parser = argparse.ArgumentParser(description="Управление процессами AI News Digest Aggregator")
    
    # Создаем группу для взаимоисключающих аргументов
    action_group = parser.add_mutually_exclusive_group(required=True)
    action_group.add_argument('--start', choices=list(PROCESSES.keys()) + ['all'], 
                        help='Запустить указанный процесс или все процессы')
    action_group.add_argument('--stop', choices=list(PROCESSES.keys()) + ['all'], 
                        help='Остановить указанный процесс или все процессы')
    action_group.add_argument('--restart', choices=list(PROCESSES.keys()) + ['all'], 
                        help='Перезапустить указанный процесс или все процессы')
    action_group.add_argument('--status', action='store_true', 
                        help='Показать статус всех процессов')
    
    args = parser.parse_args()
    
    # Проверка зависимостей
    try:
        import psutil
    except ImportError:
        print("Ошибка: Необходимо установить библиотеку psutil")
        print("Выполните: pip install psutil")
        return
    
    # Выполнение действий
    if args.start:
        if args.start == 'all':
            start_all()
        else:
            start_process(args.start)
    
    elif args.stop:
        if args.stop == 'all':
            stop_all()
        else:
            stop_process(args.stop)
    
    elif args.restart:
        if args.restart == 'all':
            stop_all()
            time.sleep(2)
            start_all()
        else:
            stop_process(args.restart)
            time.sleep(2)
            start_process(args.restart)
    
    elif args.status:
        list_running()
    
    # В конце выводим текущий статус
    list_running()

if __name__ == "__main__":
    main() 