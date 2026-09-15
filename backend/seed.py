import os
import logging
from datetime import datetime, timezone, timedelta

logger = logging.getLogger(__name__)

IMG = {
    "marmita1": "https://images.unsplash.com/photo-1751890893837-d43f80a5baf8?crop=entropy&cs=srgb&fm=jpg&q=80&w=800",
    "marmita2": "https://images.unsplash.com/photo-1562967914-70f9865b4c2f?crop=entropy&cs=srgb&fm=jpg&q=80&w=800",
    "frito": "https://images.unsplash.com/photo-1509236715619-171588ce72d5?crop=entropy&cs=srgb&fm=jpg&q=80&w=800",
    "mesa": "https://images.unsplash.com/photo-1709114107937-6dec855d9ab5?crop=entropy&cs=srgb&fm=jpg&q=80&w=800",
    "marmita_cat": "https://images.unsplash.com/photo-1653681472495-0a62d97e37fb?crop=entropy&cs=srgb&fm=jpg&q=80&w=800",
    "burger1": "https://images.unsplash.com/photo-1610614991969-ceeb293e7ff5?crop=entropy&cs=srgb&fm=jpg&q=80&w=800",
    "burger2": "https://images.unsplash.com/photo-1512152272829-e3139592d56f?crop=entropy&cs=srgb&fm=jpg&q=80&w=800",
    "burger3": "https://images.unsplash.com/photo-1610614819513-58e34989848b?crop=entropy&cs=srgb&fm=jpg&q=80&w=800",
    "burger4": "https://images.unsplash.com/photo-1615996001375-c7ef13294436?crop=entropy&cs=srgb&fm=jpg&q=80&w=800",
    "burger_cat": "https://images.unsplash.com/photo-1561758033-d89a9ad46330?crop=entropy&cs=srgb&fm=jpg&q=80&w=800",
    "burger_banner": "https://images.unsplash.com/photo-1610440042657-612c34d95e9f?crop=entropy&cs=srgb&fm=jpg&q=80&w=800",
    "pizza1": "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?crop=entropy&cs=srgb&fm=jpg&q=80&w=800",
    "pizza2": "https://images.unsplash.com/photo-1692737580547-b45bb4a02356?crop=entropy&cs=srgb&fm=jpg&q=80&w=800",
    "pizza3": "https://images.unsplash.com/photo-1628840042765-356cda07504e?crop=entropy&cs=srgb&fm=jpg&q=80&w=800",
    "pizza4": "https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?crop=entropy&cs=srgb&fm=jpg&q=80&w=800",
    "pizza_cat": "https://images.unsplash.com/photo-1593504049359-74330189a345?crop=entropy&cs=srgb&fm=jpg&q=80&w=800",
    "pizza_banner": "https://images.unsplash.com/photo-1513104890138-7c749659a591?crop=entropy&cs=srgb&fm=jpg&q=80&w=800",
    "pizzaria_cover": "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?crop=entropy&cs=srgb&fm=jpg&q=80&w=800",
    "acai1": "https://images.unsplash.com/photo-1654923064926-be7e64267a31?crop=entropy&cs=srgb&fm=jpg&q=80&w=800",
    "acai2": "https://images.unsplash.com/photo-1709139068234-f83a548f3bec?crop=entropy&cs=srgb&fm=jpg&q=80&w=800",
    "acai3": "https://images.unsplash.com/photo-1684403620650-81dc661a69db?crop=entropy&cs=srgb&fm=jpg&q=80&w=800",
    "acai4": "https://images.unsplash.com/photo-1590288488147-f46142daf112?crop=entropy&cs=srgb&fm=jpg&q=80&w=800",
    "sushi1": "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?crop=entropy&cs=srgb&fm=jpg&q=80&w=800",
    "sushi2": "https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?crop=entropy&cs=srgb&fm=jpg&q=80&w=800",
    "sushi3": "https://images.unsplash.com/photo-1611143669185-af224c5e3252?crop=entropy&cs=srgb&fm=jpg&q=80&w=800",
    "padaria1": "https://images.unsplash.com/photo-1608198093002-ad4e005484ec?crop=entropy&cs=srgb&fm=jpg&q=80&w=800",
    "padaria2": "https://images.unsplash.com/photo-1568254183919-78a4f43a2877?crop=entropy&cs=srgb&fm=jpg&q=80&w=800",
    "padaria3": "https://images.unsplash.com/photo-1534432182912-63863115e106?crop=entropy&cs=srgb&fm=jpg&q=80&w=800",
    "mercado": "https://images.unsplash.com/photo-1587241321921-91a834d6d191?crop=entropy&cs=srgb&fm=jpg&q=80&w=800",
    "cozinha": "https://images.unsplash.com/photo-1653796149139-c9da8470e6b4?crop=entropy&cs=srgb&fm=jpg&q=80&w=800",
}

FLOW = ["PENDING", "ACCEPTED", "PREPARING", "READY", "OUT_FOR_DELIVERY", "DELIVERED"]


def full_hours(open1="11:00", close1="14:00", open2="18:00", close2="23:00"):
    return {str(d): [{"open": open1, "close": close1}, {"open": open2, "close": close2}] for d in range(7)}


def allday_hours():
    return {str(d): [{"open": "07:00", "close": "22:00"}] for d in range(7)}


async def seed_admin(db):
    from security import hash_password, verify_password
    email = os.environ.get("ADMIN_EMAIL", "admin@zupi.app")
    password = os.environ.get("ADMIN_PASSWORD", "Zupi@2026")
    existing = await db.users.find_one({"email": email})
    if existing is None:
        await db.users.insert_one({
            "id": __import__("uuid").uuid4().hex, "name": "Administrador Zupi", "email": email,
            "password_hash": hash_password(password), "phone": "", "role": "admin",
            "blocked": False, "token_version": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info("Admin seed criado: %s", email)
    elif not verify_password(password, existing["password_hash"]):
        await db.users.update_one({"email": email}, {"$set": {"password_hash": hash_password(password), "role": "admin", "blocked": False}})


async def seed_demo(db):
    if await db.meta.find_one({"id": "seed_v1_done"}):
        return
    if await db.restaurants.count_documents({}) > 0:
        await db.meta.update_one({"id": "seed_v1_done"}, {"$set": {"id": "seed_v1_done", "skipped": True}}, upsert=True)
        return
    from security import hash_password
    from utils import uid, now_iso
    logger.info("Semeando dados de demonstração do Zupi (banco vazio)...")
    pw = hash_password("zupi123")
    now = datetime.now(timezone.utc)

    cities = [
        {"id": uid(), "name": n, "state": "SP", "active": True, "created_at": now_iso()}
        for n in ["Pradópolis", "Sertãozinho", "Jaboticabal", "Ribeirão Preto", "Barrinha", "Guariba", "Araraquara"]
    ]
    await db.cities.insert_many(cities)

    cat_defs = [
        ("Marmitas", IMG["marmita_cat"]), ("Lanches", IMG["burger_cat"]), ("Pizza", IMG["pizza_cat"]),
        ("Pastel", IMG["frito"]), ("Açaí", IMG["acai1"]), ("Comida Brasileira", IMG["marmita1"]),
        ("Japonesa", IMG["sushi2"]), ("Doces", IMG["acai2"]), ("Bebidas", IMG["mesa"]),
        ("Mercado", IMG["mercado"]), ("Padaria", IMG["padaria1"]), ("Outros", IMG["cozinha"]),
    ]
    await db.categories.insert_many([
        {"id": uid(), "name": n, "image": img, "icon": "utensils", "order": i, "active": True, "created_at": now_iso()}
        for i, (n, img) in enumerate(cat_defs)
    ])

    async def mkuser(name, email, role):
        doc = {"id": uid(), "name": name, "email": email, "password_hash": pw, "phone": "(16) 99999-0000",
               "role": role, "blocked": False, "token_version": 0, "created_at": now_iso()}
        await db.users.insert_one(doc)
        return doc

    cliente = await mkuser("Maria Silva", "cliente@zupi.com", "customer")
    c2 = await mkuser("João Santos", "joao@zupi.com", "customer")
    c3 = await mkuser("Ana Oliveira", "ana@zupi.com", "customer")
    lojista = await mkuser("Carlos Mendes", "lojista@zupi.com", "restaurant")

    await db.addresses.insert_one({
        "id": uid(), "user_id": cliente["id"], "label": "Casa", "cep": "14160-000",
        "street": "Rua das Flores", "number": "123", "complement": "", "district": "Centro",
        "city": "Sertãozinho", "state": "SP", "reference": "Próximo à praça", "lat": None, "lng": None,
        "created_at": now_iso(),
    })

    zones_default = [
        {"district": "Centro", "fee": 3.0},
        {"district": "Jardim Paulista", "fee": 5.0},
        {"district": "Vila Nova", "fee": 7.0},
    ]

    R = []

    def rest(owner_id, name, desc, category, city, cover, fee, min_order, prep, rating, rc, featured=False, hours=None, status="active"):
        doc = {
            "id": uid(), "owner_id": owner_id, "name": name, "description": desc, "category": category,
            "phone": "(16) 3333-0000", "logo": cover, "cover": cover, "city": city, "state": "SP",
            "address": {"street": "Av. Brasil", "number": "100", "district": "Centro", "city": city, "state": "SP", "cep": "14160-000"},
            "delivery_fee": fee, "min_order": min_order, "prep_time": prep,
            "payment_methods": ["pix", "cash", "card_machine"],
            "delivery_zones": zones_default, "hours": hours or full_hours(),
            "status": status, "featured": featured, "paused": False,
            "rating": rating, "rating_count": rc, "order_count": 0, "created_at": now_iso(),
        }
        R.append(doc)
        return doc

    r1 = rest(lojista["id"], "Sabor da Terra — Marmitaria", "Comida caseira feita com carinho todos os dias. Marmitas fresquinhas e pratos tradicionais.", "Marmitas", "Sertãozinho", IMG["cozinha"], 3.0, 15, 30, 4.8, 126, True)
    o2 = await mkuser("Pedro Lima", "dono.burgueria@zupi.com", "restaurant")
    r2 = rest(o2["id"], "Burgueria da Cidade", "Burgers artesanais com blend 180g e pão brioche fresquinho.", "Lanches", "Sertãozinho", IMG["burger_cat"], 4.0, 20, 35, 4.6, 89, True)
    o3 = await mkuser("Luiza Prado", "dono.pizzaria@zupi.com", "restaurant")
    r3 = rest(o3["id"], "Pizzaria Bella Cidade", "Pizzas no forno a lenha, massa fina e crocante.", "Pizza", "Sertãozinho", IMG["pizzaria_cover"], 5.0, 25, 45, 4.7, 210, True)
    o4 = await mkuser("José Ferreira", "dono.acai@zupi.com", "restaurant")
    r4 = rest(o4["id"], "Açaí do Zé", "O açaí mais cremoso da cidade, com acompanhamentos à vontade.", "Açaí", "Jaboticabal", IMG["acai1"], 3.5, 12, 20, 4.9, 342, True)
    o5 = await mkuser("Rosa Souza", "dono.pastel@zupi.com", "restaurant")
    r5 = rest(o5["id"], "Pastel da Feira", "Pastel crocante e caldo de cana gelado, tradição de feira.", "Pastel", "Jaboticabal", IMG["frito"], 3.0, 10, 25, 4.5, 78)
    o6 = await mkuser("Kenji Nakama", "dono.sushi@zupi.com", "restaurant")
    r6 = rest(o6["id"], "Sushi Nakama", "Combinados japoneses frescos com peixes selecionados.", "Japonesa", "Ribeirão Preto", IMG["sushi2"], 6.0, 30, 40, 4.8, 156)
    o7 = await mkuser("Clara Doce", "dono.doce@zupi.com", "restaurant")
    r7 = rest(o7["id"], "Doce Encanto", "Bolos caseiros, brigadeiros e sobremesas artesanais.", "Doces", "Ribeirão Preto", IMG["acai2"], 4.0, 15, 30, 4.7, 64)
    o8 = await mkuser("Seu Antônio", "dono.padaria@zupi.com", "restaurant")
    r8 = rest(o8["id"], "Padaria Pão Quente", "Pão quentinho o dia todo, cafés e confeitaria.", "Padaria", "Pradópolis", IMG["padaria1"], 2.5, 8, 20, 4.6, 98, hours=allday_hours())
    o9 = await mkuser("Bruno Costa", "dono.churras@zupi.com", "restaurant")
    r9 = rest(o9["id"], "Churrascaria Boi Gordo", "Carnes nobres na brasa e marmitas de churrasco.", "Comida Brasileira", "Barrinha", IMG["marmita2"], 5.0, 20, 40, 4.7, 143)
    o10 = await mkuser("Marta Ribeiro", "dono.mercado@zupi.com", "restaurant")
    r10 = rest(o10["id"], "Mercadinho Central", "Mercearia completa com entrega rápida no seu bairro.", "Mercado", "Araraquara", IMG["mercado"], 4.0, 10, 25, 4.4, 52, hours=allday_hours())

    await db.restaurants.insert_many(R)

    products = []
    menu_cats = []

    def menu(rest, entries):
        for ci, (cname, prods) in enumerate(entries):
            mc = {"id": uid(), "restaurant_id": rest["id"], "name": cname, "order": ci, "created_at": now_iso()}
            menu_cats.append(mc)
            for pi, (name, desc, price, img, promo, addons) in enumerate(prods):
                products.append({
                    "id": uid(), "restaurant_id": rest["id"], "category_id": mc["id"],
                    "name": name, "description": desc, "price": price, "promo_price": promo,
                    "image": img, "available": True,
                    "addons": [{"id": uid(), "name": an, "price": ap} for an, ap in (addons or [])],
                    "order": pi, "created_at": now_iso(),
                })

    menu(r1, [
        ("Marmitas", [
            ("Marmita Tradicional", "Arroz, feijão carioca, bife acebolado, salada e farofa", 18.9, IMG["marmita1"], None, [("Batata frita", 6), ("Ovo frito", 2.5), ("Refrigerante lata", 5)]),
            ("Marmita Frango Grelhado", "Arroz, feijão, peito de frango grelhado e legumes", 17.9, IMG["marmita2"], None, [("Batata frita", 6), ("Ovo frito", 2.5)]),
            ("Marmita Parmegiana", "Frango à parmegiana com arroz branco e batata", 24.9, IMG["frito"], 21.9, [("Queijo extra", 3)]),
        ]),
        ("Pratos", [
            ("Feijoada Completa", "Feijoada tradicional com couve, laranja e torresmo (qua e sáb)", 29.9, IMG["mesa"], None, [("Torresmo extra", 7)]),
            ("Virado à Paulista", "Arroz, feijão tutu, bisteca, couve e banana frita", 26.9, IMG["marmita_cat"], None, []),
        ]),
        ("Bebidas", [
            ("Refrigerante 2L", "Coca-Cola, Guaraná ou Fanta", 12.0, "", None, []),
            ("Suco Natural 500ml", "Laranja, maracujá ou limão", 8.0, "", None, []),
            ("Água Mineral 500ml", "Sem gás", 3.0, "", None, []),
        ]),
    ])
    menu(r2, [
        ("Burgers", [
            ("Zupi Burger", "Blend 180g, queijo prato, alface, tomate e maionese da casa no pão brioche", 25.0, IMG["burger1"], None, [("Queijo extra", 3), ("Bacon crocante", 5), ("Ovo", 2)]),
            ("Duplo Cheddar", "Dois blends 180g, cheddar duplo e cebola caramelizada", 32.0, IMG["burger2"], None, [("Bacon crocante", 5), ("Batata rústica", 8)]),
            ("Chicken Crispy", "Frango empanado crocante, alface e molho especial", 22.0, IMG["burger3"], 19.9, [("Queijo extra", 3)]),
        ]),
        ("Porções", [
            ("Batata Rústica 400g", "Batatas rústicas com alecrim e alho", 16.0, IMG["burger4"], None, [("Cheddar cremoso", 5)]),
            ("Anéis de Cebola", "300g de anéis empanados crocantes", 14.0, "", None, []),
        ]),
        ("Bebidas", [
            ("Milk-shake 500ml", "Chocolate, morango ou ovomaltine", 15.0, "", None, []),
            ("Refrigerante lata", "350ml gelado", 5.0, "", None, []),
        ]),
    ])
    menu(r3, [
        ("Pizzas Tradicionais", [
            ("Mussarela", "Molho de tomate, mussarela e orégano", 39.9, IMG["pizza_cat"], None, [("Borda recheada", 8), ("Queijo extra", 6)]),
            ("Calabresa", "Calabresa fatiada, cebola e azeitonas", 42.9, IMG["pizza4"], None, [("Borda recheada", 8)]),
            ("Portuguesa", "Presunto, ovos, cebola, azeitona e mussarela", 45.9, IMG["pizza1"], None, [("Borda recheada", 8)]),
        ]),
        ("Pizzas Especiais", [
            ("Pepperoni", "Pepperoni importado e mussarela", 52.9, IMG["pizza2"], 47.9, [("Borda recheada", 8)]),
            ("Frango c/ Catupiry", "Frango desfiado com catupiry original", 49.9, IMG["pizza3"], None, [("Borda recheada", 8)]),
        ]),
        ("Bebidas", [
            ("Refrigerante 2L", "Coca-Cola ou Guaraná", 12.0, "", None, []),
        ]),
    ])
    menu(r4, [
        ("Açaí", [
            ("Açaí 300ml", "Açaí cremoso batido na hora", 12.0, IMG["acai3"], None, [("Granola", 2), ("Leite ninho", 3), ("Morango", 4), ("Banana", 2)]),
            ("Açaí 500ml", "Açaí cremoso 500ml", 16.0, IMG["acai2"], 14.9, [("Granola", 2), ("Leite ninho", 3), ("Morango", 4)]),
            ("Açaí 700ml", "Para os mais famintos", 22.0, IMG["acai4"], None, [("Granola", 2), ("Leite ninho", 3)]),
        ]),
        ("Sobremesas", [
            ("Banana Split", "Sorvete, banana, calda e chantilly", 15.0, IMG["mesa"], None, []),
            ("Petit Gâteau", "Bolinho de chocolate com sorvete de creme", 14.0, "", None, []),
        ]),
    ])
    menu(r5, [
        ("Pastéis", [
            ("Pastel de Carne", "Carne moída temperada com azeitona", 10.0, IMG["frito"], None, [("Catupiry", 3)]),
            ("Pastel de Queijo", "Queijo mussarela derretido", 9.0, "", None, [("Orégano extra", 1)]),
            ("Pastel de Pizza", "Queijo, presunto, tomate e orégano", 11.0, "", None, []),
        ]),
        ("Bebidas", [
            ("Caldo de Cana 500ml", "Prensado na hora", 7.0, "", None, []),
            ("Refrigerante lata", "350ml gelado", 5.0, "", None, []),
        ]),
    ])
    menu(r6, [
        ("Combinados", [
            ("Combo 20 peças", "Sashimi, niguiri, uramaki e hossomaki", 49.9, IMG["sushi2"], None, [("Shoyu extra", 1), ("Hashi extra", 1)]),
            ("Combo 30 peças", "Seleção do chef com 30 peças variadas", 69.9, IMG["sushi1"], 64.9, [("Shoyu extra", 1)]),
        ]),
        ("Hot Rolls", [
            ("Hot Roll 10 un", "Uramaki empanado com salmão e cream cheese", 29.9, IMG["sushi3"], None, [("Tarê extra", 2)]),
        ]),
        ("Bebidas", [
            ("Chá Gelado 500ml", "Chá verde com limão", 6.0, "", None, []),
        ]),
    ])
    menu(r7, [
        ("Bolos", [
            ("Fatia de Bolo de Chocolate", "Bolo fofinho com cobertura de brigadeiro", 9.0, IMG["acai2"], None, []),
            ("Bolo Caseiro Inteiro", "Encomenda: chocolate, cenoura ou milho", 45.0, "", None, []),
        ]),
        ("Doces", [
            ("Brigadeiro (un)", "Brigadeiro gourmet de chocolate belga", 3.5, "", None, []),
            ("Beijinho (un)", "Docinho de coco tradicional", 3.5, "", None, []),
            ("Brownie", "Brownie de chocolate com nozes", 8.0, IMG["mesa"], None, []),
        ]),
    ])
    menu(r8, [
        ("Pães", [
            ("Pão Francês 100g", "Pão fresquinho da hora", 2.0, IMG["padaria1"], None, []),
            ("Pão de Queijo 300g", "Pão de queijo mineiro assado na hora", 12.0, IMG["padaria2"], None, []),
        ]),
        ("Confeitaria", [
            ("Sonho de Creme", "Sonho frito recheado", 5.0, IMG["padaria3"], None, []),
            ("Fatia de Bolo de Cenoura", "Com cobertura de chocolate", 7.0, "", None, []),
        ]),
        ("Cafés", [
            ("Café com Leite 300ml", "Pingado cremoso", 6.0, "", None, []),
        ]),
    ])
    menu(r9, [
        ("Marmitas", [
            ("Marmita Churrasco Misto", "Contra-filé, linguiça, arroz, feijão tropeiro e vinagrete", 28.0, IMG["marmita2"], None, [("Farofa", 3), ("Vinagrete extra", 2)]),
        ]),
        ("Pratos", [
            ("Picanha na Chapa", "400g de picanha com arroz e fritas", 59.9, IMG["marmita1"], None, [("Farofa", 3)]),
            ("Costela 500g", "Costela bovina desfiando, mandioca cozida", 39.9, IMG["frito"], None, []),
        ]),
        ("Bebidas", [
            ("Refrigerante 2L", "Coca-Cola ou Guaraná", 12.0, "", None, []),
        ]),
    ])
    menu(r10, [
        ("Bebidas", [
            ("Cerveja Long Neck", "Gelada (venda apenas +18)", 6.0, "", None, []),
            ("Refrigerante 2L", "Coca-Cola, Guaraná ou Fanta", 11.0, "", None, []),
            ("Água Mineral 1,5L", "Sem gás", 4.0, "", None, []),
        ]),
        ("Mercearia", [
            ("Arroz Branco 5kg", "Tipo 1", 29.9, "", None, []),
            ("Feijão Carioca 1kg", "Tipo 1", 8.9, "", None, []),
        ]),
        ("Limpeza", [
            ("Sabão em Pó 800g", "Lavagem perfeita", 12.9, "", None, []),
            ("Detergente 500ml", "Neutro", 2.5, "", None, []),
        ]),
    ])

    await db.menu_categories.insert_many(menu_cats)
    await db.products.insert_many(products)

    prods_by_rest = {}
    for p in products:
        prods_by_rest.setdefault(p["restaurant_id"], []).append(p)

    async def mkorder(customer, rest, picks, status, hours_ago, seq, delivery_type="delivery", payment="pix", discount=0.0, coupon=None):
        items = []
        subtotal = 0.0
        for p, qty in picks:
            price = float(p.get("promo_price") or p["price"])
            line = round(price * qty, 2)
            subtotal += line
            items.append({"product_id": p["id"], "name": p["name"], "unit_price": round(price, 2), "qty": qty,
                          "addons": [], "notes": "", "line_total": line})
        fee = rest["delivery_fee"] if delivery_type == "delivery" else 0.0
        total = round(max(subtotal - discount, 0) + fee, 2)
        created = now - timedelta(hours=hours_ago)
        if status == "CANCELLED":
            hist_flow = ["PENDING", "CANCELLED"]
        else:
            idx = FLOW.index(status)
            hist_flow = FLOW[: idx + 1]
        history = [{"status": s, "at": (created + timedelta(minutes=8 * i)).isoformat()} for i, s in enumerate(hist_flow)]
        oid = uid()
        order = {
            "id": oid, "code": f"#{1001 + seq}",
            "customer_id": customer["id"], "customer_name": customer["name"], "customer_phone": customer["phone"],
            "restaurant_id": rest["id"], "restaurant_name": rest["name"], "city": rest["city"],
            "items": items, "subtotal": round(subtotal, 2), "delivery_fee": round(fee, 2),
            "discount": discount, "coupon_code": coupon, "total": total, "zupi_fee": 2.0,
            "delivery_type": delivery_type,
            "address": {"label": "Casa", "cep": "14160-000", "street": "Rua das Flores", "number": "123",
                        "complement": "", "district": "Centro", "city": rest["city"], "state": "SP", "reference": ""} if delivery_type == "delivery" else None,
            "payment_method": payment, "change_for": None,
            "status": status, "status_history": history,
            "pickup_code": oid[:6].upper() if delivery_type == "pickup" else None,
            "reviewed": False, "created_at": created.isoformat(),
        }
        await db.orders.insert_one(order)
        await db.restaurants.update_one({"id": rest["id"]}, {"$inc": {"order_count": 1}})
        await db.transactions.insert_one({
            "id": uid(), "type": "zupi_fee", "amount": 2.0, "order_id": oid,
            "restaurant_id": rest["id"], "description": f"Taxa Zupi pedido {order['code']}", "created_at": created.isoformat(),
        })
        if status == "CANCELLED":
            await db.transactions.insert_one({
                "id": uid(), "type": "zupi_fee_reversal", "amount": -2.0, "order_id": oid,
                "restaurant_id": rest["id"], "description": f"Estorno taxa Zupi pedido {order['code']}", "created_at": created.isoformat(),
            })
        return order

    p1 = prods_by_rest[r1["id"]]
    p2 = prods_by_rest[r2["id"]]
    p3 = prods_by_rest[r3["id"]]
    p4 = prods_by_rest[r4["id"]]

    delivered1 = await mkorder(cliente, r1, [(p1[0], 2), (p1[7], 1)], "DELIVERED", 220, 0, payment="pix")
    delivered2 = await mkorder(c2, r1, [(p1[2], 1), (p1[6], 1)], "DELIVERED", 150, 1, payment="cash")
    delivered3 = await mkorder(c3, r1, [(p1[1], 3)], "DELIVERED", 96, 2, payment="pix", discount=3.0, coupon="ZUPI10")
    await mkorder(cliente, r1, [(p1[3], 1)], "DELIVERED", 50, 3, delivery_type="pickup")
    await mkorder(c2, r1, [(p1[0], 1), (p1[5], 2)], "DELIVERED", 30, 4)
    await mkorder(c3, r1, [(p1[4], 1), (p1[6], 1)], "CANCELLED", 26, 5)
    await mkorder(cliente, r1, [(p1[2], 2)], "OUT_FOR_DELIVERY", 1, 6, payment="pix")
    await mkorder(c2, r1, [(p1[0], 1), (p1[1], 1), (p1[7], 1)], "PREPARING", 0.5, 7)
    await mkorder(c3, r1, [(p1[3], 1), (p1[5], 1)], "PENDING", 0.1, 8, payment="cash")
    await mkorder(cliente, r2, [(p2[0], 1), (p2[3], 1)], "DELIVERED", 200, 9, payment="online")
    await mkorder(c2, r2, [(p2[1], 1), (p2[6], 2)], "DELIVERED", 75, 10)
    await mkorder(c3, r2, [(p2[2], 2)], "ACCEPTED", 0.3, 11, payment="pix")
    await mkorder(cliente, r3, [(p3[3], 1), (p3[5], 1)], "DELIVERED", 120, 12, payment="pix", discount=5.0, coupon="ZUPI10")
    await mkorder(c2, r3, [(p3[0], 1), (p3[1], 1)], "DELIVERED", 60, 13)
    await mkorder(c3, r4, [(p4[1], 2), (p4[3], 1)], "DELIVERED", 90, 14)
    await mkorder(cliente, r4, [(p4[0], 1)], "READY", 0.2, 15, delivery_type="pickup")

    await db.reviews.insert_many([
        {"id": uid(), "order_id": delivered1["id"], "customer_id": cliente["id"], "customer_name": cliente["name"],
         "restaurant_id": r1["id"], "rating": 5, "food_rating": 5, "delivery_rating": 5,
         "comment": "Marmita deliciosa, chegou quentinha! Melhor custo-benefício da cidade.", "moderated": False,
         "created_at": (now - timedelta(hours=210)).isoformat()},
        {"id": uid(), "order_id": delivered2["id"], "customer_id": c2["id"], "customer_name": c2["name"],
         "restaurant_id": r1["id"], "rating": 5, "food_rating": 5, "delivery_rating": 4,
         "comment": "Parmegiana muito bem servida. Voltarei a pedir.", "moderated": False,
         "created_at": (now - timedelta(hours=140)).isoformat()},
        {"id": uid(), "order_id": delivered3["id"], "customer_id": c3["id"], "customer_name": c3["name"],
         "restaurant_id": r1["id"], "rating": 4, "food_rating": 4, "delivery_rating": 5,
         "comment": "Comida boa e entrega rápida.", "moderated": False,
         "created_at": (now - timedelta(hours=90)).isoformat()},
    ])

    await db.favorites.insert_many([
        {"id": uid(), "user_id": cliente["id"], "restaurant_id": r1["id"], "created_at": now_iso()},
        {"id": uid(), "user_id": cliente["id"], "restaurant_id": r2["id"], "created_at": now_iso()},
    ])

    await db.coupons.insert_many([
        {"id": uid(), "restaurant_id": None, "code": "ZUPI10", "type": "percent", "value": 10, "min_order": 30,
         "city": "", "max_uses": 500, "used_count": 2, "first_purchase": False, "active": True,
         "valid_until": (now + timedelta(days=60)).isoformat(), "created_at": now_iso()},
        {"id": uid(), "restaurant_id": None, "code": "BEMVINDO5", "type": "fixed", "value": 5, "min_order": 20,
         "city": "", "max_uses": 1000, "used_count": 0, "first_purchase": True, "active": True,
         "valid_until": (now + timedelta(days=90)).isoformat(), "created_at": now_iso()},
        {"id": uid(), "restaurant_id": r1["id"], "code": "TERRA15", "type": "percent", "value": 15, "min_order": 25,
         "city": "", "max_uses": 100, "used_count": 0, "first_purchase": False, "active": True,
         "valid_until": (now + timedelta(days=30)).isoformat(), "created_at": now_iso()},
    ])

    await db.banners.insert_many([
        {"id": uid(), "title": "Pizza na sexta? Taxa justa sempre.", "subtitle": "Peça na Bella Cidade com entrega a partir de R$ 5",
         "image": IMG["pizza_banner"], "link": f"/restaurante/{r3['id']}", "city": "", "position": 0,
         "start_date": None, "end_date": None, "active": True, "created_at": now_iso()},
        {"id": uid(), "title": "Os melhores burgers da sua cidade", "subtitle": "Burgueria da Cidade com promoções toda semana",
         "image": IMG["burger_banner"], "link": f"/restaurante/{r2['id']}", "city": "", "position": 1,
         "start_date": None, "end_date": None, "active": True, "created_at": now_iso()},
    ])

    await db.notifications.insert_one({
        "id": uid(), "user_id": cliente["id"], "title": "Bem-vinda ao Zupi Delivery!",
        "body": "Use o cupom ZUPI10 e ganhe 10% off em pedidos acima de R$ 30.",
        "type": "promo", "order_id": None, "read": False, "created_at": now_iso(),
    })

    await db.settings.update_one({"id": "platform"}, {"$set": {"id": "platform", "platform_fee": 2.0, "platform_name": "Zupi Delivery"}}, upsert=True)
    await db.meta.update_one({"id": "seed_v1_done"}, {"$set": {"id": "seed_v1_done", "at": now_iso()}}, upsert=True)
    logger.info("Seed concluído: %d restaurantes, %d produtos", len(R), len(products))
