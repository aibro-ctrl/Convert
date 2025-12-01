# Пример работы валидации учетных данных

## Успешная валидация

```bash
$ ./setup.sh

╔══════════════════════════════════════════════════════════════╗
║   ██╗  ██╗ ██████╗ ███╗   ██╗██╗   ██╗███████╗██████╗ ████████╗
║   ... (ASCII art)
╚══════════════════════════════════════════════════════════════╝

╔════════════════════════════════════════════════════╗
║  Шаг 2: Авторизация в PocketBase
╚════════════════════════════════════════════════════╝

ℹ Для создания коллекций требуется администратор PocketBase
ℹ Если вы еще не создали администратора, откройте:
ℹ http://127.0.0.1:54739/_/

ℹ Проверка наличия администратора...
✓ Администратор уже создан

? Вы уже создали администратора PocketBase? [Y/n]: y
? Email администратора: admin@localhost
? Пароль администратора: ********

ℹ Проверка учетных данных...
✓ Авторизация успешна!
ℹ ID администратора: abc123xyz456

▶ Создание backend-setup/.env
✓ backend-setup/.env создан
...
```

---

## Неверные учетные данные (с повтором)

```bash
$ ./setup.sh

...
? Email администратора: admin@wrong.com
? Пароль администратора: ********

ℹ Проверка учетных данных...
✗ Авторизация не удалась
✗ Ошибка: Failed to authenticate.
⚠ Проверьте правильность email и пароля
ℹ Email должен быть валидным (например: admin@localhost)
ℹ Пароль должен быть минимум 8 символов

⚠ Попытка 2 из 3
? Попробовать снова? [Y/n]: y

? Email администратора: admin@localhost
? Пароль администратора: ********

ℹ Проверка учетных данных...
✓ Авторизация успешна!
ℹ ID администратора: abc123xyz456

▶ Создание backend-setup/.env
✓ backend-setup/.env создан
...
```

---

## Превышено количество попыток

```bash
$ ./setup.sh

...
? Email администратора: wrong@email.com
? Пароль администратора: ********

ℹ Проверка учетных данных...
✗ Авторизация не удалась
✗ Ошибка: Failed to authenticate.
⚠ Проверьте правильность email и пароля
ℹ Email должен быть валидным (например: admin@localhost)
ℹ Пароль должен быть минимум 8 символов

⚠ Попытка 2 из 3
? Попробовать снова? [Y/n]: y

? Email администратора: still@wrong.com
? Пароль администратора: ********

ℹ Проверка учетных данных...
✗ Авторизация не удалась
✗ Ошибка: Failed to authenticate.
⚠ Проверьте правильность email и пароля
ℹ Email должен быть валидным (например: admin@localhost)
ℹ Пароль должен быть минимум 8 символов

⚠ Попытка 3 из 3
? Попробовать снова? [Y/n]: y

? Email администратора: bad@credentials.com
? Пароль администратора: ********

ℹ Проверка учетных данных...
✗ Авторизация не удалась
✗ Ошибка: Failed to authenticate.
⚠ Проверьте правильность email и пароля
ℹ Email должен быть валидным (например: admin@localhost)
ℹ Пароль должен быть минимум 8 символов

✗ Превышено максимальное количество попыток (3)
ℹ Убедитесь что администратор создан: http://127.0.0.1:54739/_/
```

---

## Отказ от повторной попытки

```bash
$ ./setup.sh

...
? Email администратора: wrong@email.com
? Пароль администратора: ********

ℹ Проверка учетных данных...
✗ Авторизация не удалась
✗ Ошибка: Failed to authenticate.
⚠ Проверьте правильность email и пароля
ℹ Email должен быть валидным (например: admin@localhost)
ℹ Пароль должен быть минимум 8 символов

? Попробовать снова? [Y/n]: n

✗ Невозможно продолжить без валидных учетных данных администратора
```

---

## Использование validate-admin.js напрямую

```bash
# Успешная авторизация
$ node validate-admin.js admin@localhost mypassword123 http://127.0.0.1:54739
SUCCESS
{"id":"abc123xyz456","email":"admin@localhost","created":"2024-12-01T10:00:00.000Z"}

# Выход: 0

# Неверные учетные данные
$ node validate-admin.js admin@localhost wrongpassword http://127.0.0.1:54739
FAILED
{"status":400,"message":"Failed to authenticate.","data":{}}

# Выход: 1

# Администратор не создан
$ node validate-admin.js test@test.com test12345678 http://127.0.0.1:54739
FAILED
{"status":404,"message":"The requested resource wasn't found.","data":null}

# Выход: 1

# Отсутствуют аргументы
$ node validate-admin.js
ERROR: Missing arguments
Usage: node validate-admin.js <email> <password> [url]

# Выход: 2

# PocketBase недоступен
$ node validate-admin.js admin@localhost password http://127.0.0.1:99999
ERROR
{"message":"fetch failed"}

# Выход: 3
```

---

## Коды выхода validate-admin.js

- **0** - Успешная авторизация
- **1** - Авторизация не удалась (неверные данные или администратор не создан)
- **2** - Ошибка в аргументах командной строки
- **3** - Ошибка подключения к PocketBase

---

## Использование в других скриптах

### Bash
```bash
#!/bin/bash

EMAIL="admin@localhost"
PASSWORD="mypassword"
URL="http://127.0.0.1:54739"

if node validate-admin.js "$EMAIL" "$PASSWORD" "$URL" > /dev/null 2>&1; then
    echo "✓ Авторизация успешна"
else
    echo "✗ Авторизация не удалась"
    exit 1
fi
```

### Node.js
```javascript
const { execSync } = require('child_process');

function validateAdmin(email, password, url) {
  try {
    const result = execSync(
      `node validate-admin.js "${email}" "${password}" "${url}"`,
      { encoding: 'utf-8' }
    );
    
    if (result.includes('SUCCESS')) {
      const data = JSON.parse(result.split('\n')[1]);
      return { success: true, data };
    }
    
    return { success: false };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Использование
const result = validateAdmin('admin@localhost', 'password', 'http://127.0.0.1:54739');

if (result.success) {
  console.log('✓ Авторизация успешна');
  console.log('ID:', result.data.id);
} else {
  console.log('✗ Авторизация не удалась');
}
```

### Python
```python
import subprocess
import json

def validate_admin(email, password, url='http://127.0.0.1:54739'):
    try:
        result = subprocess.run(
            ['node', 'validate-admin.js', email, password, url],
            capture_output=True,
            text=True
        )
        
        if 'SUCCESS' in result.stdout:
            lines = result.stdout.strip().split('\n')
            data = json.loads(lines[1])
            return {'success': True, 'data': data}
        
        return {'success': False}
    except Exception as e:
        return {'success': False, 'error': str(e)}

# Использование
result = validate_admin('admin@localhost', 'password')

if result['success']:
    print(f"✓ Авторизация успешна")
    print(f"ID: {result['data']['id']}")
else:
    print("✗ Авторизация не удалась")
```

---

## Особенности реализации

### Безопасность

1. **Пароль скрыт при вводе** - используется `read -s` в bash
2. **Пароль передается как аргумент** - не сохраняется в истории если правильно использовать
3. **Результаты на stdout** - для парсинга в других скриптах

### Надежность

1. **3 попытки ввода** - пользователь может опечататься
2. **Понятные ошибки** - конкретно указывается что не так
3. **Проверка до установки** - не тратим время если данные неверные

### Совместимость

1. **PocketBase API v0.20+** - использует endpoint `_superusers`
2. **Обратная совместимость** - работает со старыми версиями через fallback
3. **Cross-platform** - работает на Linux, macOS, Windows (с bash)

---

## Часто задаваемые вопросы

### Q: Можно ли пропустить валидацию?

A: Нет, валидация обязательна. Но если у вас правильные данные в `.env`, скрипт их использует автоматически.

### Q: Что делать если забыл пароль администратора?

A: 
1. Откройте http://127.0.0.1:54739/_/
2. Войдите как администратор
3. Измените пароль в настройках
4. Запустите setup.sh снова с новым паролем

### Q: Можно ли использовать validate-admin.js независимо?

A: Да! Это standalone скрипт. Используйте его в любых своих скриптах для проверки учетных данных.

### Q: Что если PocketBase на другом порту?

A: Скрипт setup.sh спросит хост и порт. Или передайте третьим параметром в validate-admin.js:
```bash
node validate-admin.js admin@localhost password http://127.0.0.1:8090
```

---

**Документация:** 
- [README.md](README.md) - Обзор
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Решение проблем
- [FIX-APPLIED.md](FIX-APPLIED.md) - Последние изменения
