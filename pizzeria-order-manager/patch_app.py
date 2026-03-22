import re

with open('formatted_menu.txt', 'r') as f:
    new_menu = f.read().strip()

with open('frontend/src/App.jsx', 'r') as f:
    content = f.read()

# Replace import
if "import Logo from './assets/logo.svg';" not in content:
    content = content.replace("import './App.css';", "import './App.css';\nimport Logo from './assets/logo.svg';")

# 1. Replace MENU_ITEMS
menu_pattern = re.compile(r'const MENU_ITEMS = \[.*?\];', re.DOTALL)
content = menu_pattern.sub(lambda match: f'const MENU_ITEMS = [\n{new_menu}\n];', content)

# 2. Replace CATEGORIES_MENU
cat_pattern = re.compile(r'const CATEGORIES_MENU = \[.*?\];', re.DOTALL)
new_cat = """const CATEGORIES_MENU = [
  { id: 'tutte', label: 'Tutto' },
  { id: 'pizze', label: 'Pizze' },
  { id: ' bevande', label: 'Bevande' },
  { id: 'fritture', label: 'Fritture' },
  { id: 'dolci', label: 'Dolci' },
];"""
content = cat_pattern.sub(lambda match: new_cat, content)

# 3. Replace INGREDIENT_MODIFIERS 
mod_pattern = re.compile(r'const INGREDIENT_MODIFIERS = \[.*?\];', re.DOTALL)
content = mod_pattern.sub(lambda match: 'const INGREDIENT_MODIFIERS = [];', content)

# 4. Inject logo
logo_html = '''
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px 20px 0 20px', marginTop: '10px' }}>
          <img src={Logo} alt="Logo" style={{ height: '70px', width: 'auto' }} />
        </div>
'''
if "src={Logo}" not in content:
    content = content.replace('<div className="category-tabs"', f'{logo_html}\n        <div className="category-tabs"')

with open('frontend/src/App.jsx', 'w') as f:
    f.write(content)

