import sqlite3
import os

db_path = r"C:\Users\PHOENIX PRODUCTS\AppData\Roaming\pgadmin\pgadmin4.db"

if not os.path.exists(db_path):
    print("pgadmin4.db does not exist")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = cursor.fetchall()
    print("Tables in pgadmin4.db:", [t[0] for t in tables])

    # Let's inspect server table
    cursor.execute("SELECT * FROM server;")
    servers = cursor.fetchall()
    print("Found servers count:", len(servers))
    
    # Get column names for server table
    cursor.execute("PRAGMA table_info(server);")
    cols = [c[1] for c in cursor.fetchall()]
    print("Server columns:", cols)

    for s in servers:
        s_dict = dict(zip(cols, s))
        print("Server Name:", s_dict.get('name'))
        print("Host:", s_dict.get('host'))
        print("Port:", s_dict.get('port'))
        print("Username:", s_dict.get('username'))
        print("Dbname:", s_dict.get('db'))
        print("Password (encrypted):", s_dict.get('password') is not None)
        print("-" * 40)
except Exception as e:
    print("Error querying pgadmin4.db:", e)
finally:
    conn.close()
