import re
import json

raw_pizzas = """Calzone liscio - 7€ (Mozz, prosc. cotto, sale, olio di oliva, pom. esterno)
Calzone ai formaggi - 8.5€ (Mozz., fontina, emmenthal, grana padano d.o.p. , pom. esterno)
Calzone Delicato - 10€ (Mozz., pomodorini, brie, crudo parma, rucola, pom. esterno)
Calzone farcito - 8.5€ (Mozz., prosc.cotto, funghi champ., carciofi, pom esterno)
Focaccia liscia - 5€ (Olio di oliva, sale, rosmarino)
Focaccia cotto e formaggio - 7€ (Prosc. cotto, emmenthal, olio di oliva, sale)
Focaccia alle verdure - 8€ (Melanzane, zucchine, peperoni grigliati , sale, olio di oliva)
Focaccia mediterranea - 8€ (Pomodorini, olive , acciughe, origano, sale, olio di oliva)
Focaccia Greca - 7€ (Pomodorini, origano , sale, olio di oliva)
Margherita - 5€ (Pom, mozz)
Americana - 8€ (Pom, mozz, würstel, patatine fritte)
Bianca - 5€ (Mozz, origano, olio di oliva, sale)
Bufala - 7.5€ (Pom, mozz di bufala campana d.o.p.)
Capricciosa - 9€ (Pom, mozz, prosc.cotto, funghi champ., carciofi, olive, acciughe, origano)
Diavola - 7€ (Pom, mozz, salamino piccante, peperoncino)
Quattro Formaggi - 8€ (Pom, mozz, grana padano d.o.p., emmenthal, fontina)
Quattro Stagioni - 8€ (Pom, mozz, prosc.cotto, funghi, carciofi, olive)
Frutti di mare - 9€ (Pom, mozz, frutti di mare, olio di oliva, sale, origano)
Gamberetti - 9€ (Pom, mozz, mazzancolle tropicali, olio di oliva, sale)
Gamberetti e Rucola - 9.5€ (Pom, mozz, mazzancolle tropicali, olio di oliva, sale, rucola)
Gamberetti e Panna - 9.5€ (Pom, mozz, mazzancolle tropicali, panna, olio di oliva, sale)
Gamberetti e Zucchine - 10€ (Pom, mozz, mazzancolle tropicali, zucchine, olio di oliva, sale)
Adige - 10€ (Pom, mozz, spinaci, taleggio e speck i.g.p.)
Affumicata - 10€ (Pom, mozz, provola affumicata, speck i.g.p.)
Boscaiola - 10€ (Pom, mozz, crudo parma, funghi porcini, grana padano d.o.p.)
Caprese - 8€ (Mozz. di bufala campana d.o.p., pomodorini, basilico, olio , sale)
Carpaccio - 10€ (Pom, mozz, bresaola i.g.p., grana padano d.o.p., rucola)
Contadina - 8€ (Pom, mozz, salsiccia, taleggio)
Giudea - 10€ (Pom, mozz, carciofi, acciughe, grana padano)
Gustosa - 8€ (Pom, mozz, salsiccia, patatine fritte)
Enjoy - 10€ (Pom, mozz, zucchine gr., panna, salmone affumicato dopo cottura)
Parmigiana - 10€ (Pom, mozz, prosc.cotto, melanzane grigl., grana padano d.o.p.)
Pizza Pazza - 10€ (Pom, mozz, provola affumicata, salame nostrano Km 0)
Funghi - 7€ (Pom, mozz, funghi champignon)
Grana e Rucola - 8€ (Pom, mozz, grana padano d.o.p., rucola)
Marinara - 5€ (Doppio pom, aglio, olio di oliva, origano)
Olive - 7€ (Pom, mozz, tris di olive)
Pomodoro - 5€ (Pom, olio di oliva, origano)
Porcini - 8€ (Pom, mozz, funghi porcini)
Pomodorini - 7.5€ (Pom, mozz, pomodorini)
Prosciutto - 7€ (Pom, mozz, prosciutto cotto)
Prosciutto e Funghi - 8€ (Pom, mozz, prosc.cotto, funghi champ.)
Pugliese - 7€ (Pom, mozz, cipolla tropea, origano)
Romana - 7.5€ (Pom, mozz, acciughe, capperi, origano)
Salamino piccante - 7€ (Pom, mozz, salamino piccante)
Salsiccia - 7€ (Pom, mozz, salsiccia fresca)
Siciliana - 8.5€ (Pom, mozz, acciughe, capperi, olive, origano)
Verdure grigliate - 10€ (Pom, mozz, melanzane, zucchine, peperoni grigl.)
Würstel - 7€ (Pom, mozz, würstel)
Zola - 7€ (Pom, mozz, zola)
Zola e Noci - 9€ (Pom, mozz, zola, noci)
Profumata - 10€ (Pom, mozz, zola, aglio, cipolla tropea, grana padano d.o.p.)
Saporita - 10€ (Pom, mozz, tonno all'olio di oliva, zola, würstel)
Svizzera - 10€ (Pom, mozz, salsiccia, cipolla tropea, grana padano d.o.p.)
Tricolore - 9€ (Pom, mozz. di bufala campana d.o.p., pomodorini, basilico fresco)
Italia - 10€ (Pom, mozz, pomodorini, grana padano d.o.p., rucola)
Tedesca - 10€ (Pom, mozz., prosc. cotto, salamino picc, würstel, salsiccia)
Veneta - 10€ (Pom, mozz., salamino picc., olive, peperoni grigliati)
Zucchinella - 10€ (Pom, mozz., prosc. cotto, zucchine grigliate, provola affumicata)
Pancetta paradise - 10€ (Pom, mozz., pancetta aff., provola aff., cipolla tropea)
Appetitosa - 10€ (Pom, mozz., pancetta aff., provola aff., pomodorini)
Briscola - 10€ (Pom, mozz., pancetta aff., melanzane grigl., zola, grana pad. d.o.p.)
Mari e Monti - 10€ (Pom, mozz, frutti di mare, f. porcini, olio di oliva, sale, origano)
Tonno - 7€ (Pom, mozz, tonno all'olio di oliva)
Tonno e Cipolle - 8€ (Pom, mozz, tonno all'olio di oliva, cipolla tropea)
Bresaola - 8€ (Pom, mozz, bresaola i.g.p.)
Bresaola e Brie - 9€ (Pom, mozz, bresaola i.g.p. , brie)
Bresaola e Grana - 9€ (Pom, mozz, bresaola i.g.p., grana padano d.o.p.)
Bresaola, Grana e Rucola - 10€ (Pom, mozz, bresaola i.g.p., grana padano d.o.p., rucola)
Crudo - 8€ (Pom, mozz, crudo parma)
Crudo e Grana - 9€ (Pom, mozz, crudo parma, grana padano d.o.p.)
Crudo e Rucola - 8.5€ (Pom, mozz, crudo parma, rucola)
Crudo, Grana e Rucola - 10€ (Pom, mozz, crudo parma, grana padano d.o.p., rucola)
Crudo e Panna - 9€ (Pom, mozz, crudo parma, panna)
Crudo e Porcini - 9.5€ (Pom, mozz, crudo parma, funghi porcini)
Speck - 8€ (Pom, mozz, speck i.g.p.)
Speck e Brie - 9€ (Pom, mozz, speck, brie)
Speck e Zola - 9€ (Pom, mozz, speck, zola)
Speck e Panna - 8.5€ (Pom, mozz, speck, panna)
Speck e Porcini - 10€ (Pom, mozz, speck, porcini)
Speck, Porcini e Rucola - 10€ (Pom, mozz, speck, porcini, rucola)
Salame - 8€ (Pom, mozz, salame nostrano Km 0)
Montanara - 10€ (Pom, mozz., pancetta aff., funghi porcini, grana padano d.o.p.)
Napoli - 7€ (Pom, mozz, acciughe, origano)
Crazy - 10€ (Pom, mozz., salsiccia, trevisana, provola aff.)
Blitz - 10€ (Pom, mozz., pancetta aff., trevisana, taleggio)
Top - 10€ (Mozz., pancetta aff., trevisana, zola)
Sweet onion - 10€ (Mozz., pom, pancetta aff., cipolla caramellata, grana padano d.o.p.)
Friarielli e salsiccia - 8€ (Mozz., friarielli, salsiccia)
Friarielli boom! - 10€ (Mozz. friarielli, salsiccia, provola affumica)"""

raw_drinks = """Coca Cola 33 cl - 2€
Coca Cola Zero 33 cl - 2€
Fanta 33 cl - 2€
Sprite 33 cl - 2€
Thè limone 40 cl - 2€
Thè pesca 40 cl - 2€
Acqua naturale 0,50 l - 1.5€
Acqua frizzante 0,50 l - 1.5€
Moretti 66 cl - 4€
Ceres 33 cl - 3.5€
Menabrea 33 cl - 3.5€
Ichnusa 33 cl - 3€
Moretti 33 cl - 3€"""

raw_fritture = """Patatine fritte porz. da 300g - 4€
Crocchette di patate (6pz) - 4€
Crocchette di pollo (6pz) - 4€
Olive all'ascolana (6pz) - 4€
Mozzarelline panate (6pz) - 4€
Triangolini di Rösti (3pz) - 4€
Mix di fritti (8pz) - 5€"""

raw_dolci = """Tiramisù - 5€
Tre cioccolati - 5€"""

out = []
counter = 100

for line in raw_pizzas.strip().split('\n'):
    match = re.search(r'^(.*?) - ([\d\.]+)€ \((.*?)\)', line.strip())
    if match:
        name = match.group(1).strip()
        price = float(match.group(2))
        ingr = [i.strip() for i in match.group(3).split(',')]
        out.append(f"  {{ id: {counter}, name: '{name.replace(chr(39), chr(92)+chr(39))}', price: {price:.2f}, category: 'pizze', icon: '🍕', ingredients: {json.dumps(ingr)} }},")
        counter += 1

for line in raw_drinks.strip().split('\n'):
    match = re.search(r'^(.*?) - ([\d\.]+)€', line.strip())
    if match:
        name = match.group(1).strip()
        price = float(match.group(2))
        out.append(f"  {{ id: {counter}, name: '{name.replace(chr(39), chr(92)+chr(39))}', price: {price:.2f}, category: 'bevande', icon: '🥤' }},")
        counter += 1

for line in raw_fritture.strip().split('\n'):
    match = re.search(r'^(.*?) - ([\d\.]+)€', line.strip())
    if match:
        name = match.group(1).strip()
        price = float(match.group(2))
        out.append(f"  {{ id: {counter}, name: '{name.replace(chr(39), chr(92)+chr(39))}', price: {price:.2f}, category: 'fritture', icon: '🍟' }},")
        counter += 1

for line in raw_dolci.strip().split('\n'):
    match = re.search(r'^(.*?) - ([\d\.]+)€', line.strip())
    if match:
        name = match.group(1).strip()
        price = float(match.group(2))
        out.append(f"  {{ id: {counter}, name: '{name.replace(chr(39), chr(92)+chr(39))}', price: {price:.2f}, category: 'dolci', icon: '🍰' }},")
        counter += 1

with open('formatted_menu.txt', 'w') as f:
    f.write("\n".join(out))

