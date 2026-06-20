import os
import time
from datetime import datetime, timedelta, timezone
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv(dotenv_path="../.env")

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = "qix"

def connect_db():
    client = MongoClient(MONGO_URI)
    return client[DB_NAME]

def execute_sweep(db):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] Commencing Ephemeral Sweep...")
    
    rooms_col = db["rooms"]
    messages_col = db["messages"]

    forty_eight_hours_ago = datetime.now(timezone.utc) - timedelta(hours=48)

    destruction_query = {
        "$or": [
            {"terminated": True},
            {"lastActiveAt": {"$lt": forty_eight_hours_ago}}
        ]
    }

    rooms_to_destroy = list(rooms_col.find(destruction_query, {"_id": 1}))
    
    if not rooms_to_destroy:
        print("  -> No targets acquired. All rooms within operational parameters.")
        return

    target_ids = [room["_id"] for room in rooms_to_destroy]
    
    print(f"  -> Acquired {len(target_ids)} rooms marked for destruction.")

    msg_result = messages_col.delete_many({"roomId": {"$in": target_ids}})
    print(f"  -> Shredded {msg_result.deleted_count} encrypted message records.")

    room_result = rooms_col.delete_many({"_id": {"$in": target_ids}})
    print(f"  -> Destroyed {room_result.deleted_count} room records.")
    print("  -> Sweep Complete.")

if __name__ == "__main__":
    print("=== QIX Ephemeral Shredder Online ===")
    database = connect_db()
    
    try:
        while True:
            execute_sweep(database)
            time.sleep(600)
    except KeyboardInterrupt:
        print("\nShredder safely powered down.")