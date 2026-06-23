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
    print(f"[{datetime.now().strftime('%H:%M:%S')}] Commencing Sweep...")
    
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
        print("  -> No primary room targets acquired.")
    else:
        target_ids = [room["_id"] for room in rooms_to_destroy]
        print(f"  -> Acquired {len(target_ids)} rooms marked for destruction.")

        msg_result = messages_col.delete_many({"roomId": {"$in": target_ids}})
        print(f"  -> Shredded {msg_result.deleted_count} encrypted message records.")

        room_result = rooms_col.delete_many({"_id": {"$in": target_ids}})
        print(f"  -> Destroyed {room_result.deleted_count} room records.")


    
    active_message_room_ids = messages_col.distinct("roomId")
    
    if active_message_room_ids:
        valid_rooms = list(rooms_col.find({"_id": {"$in": active_message_room_ids}}, {"_id": 1}))
        valid_room_ids = [r["_id"] for r in valid_rooms]
        
        orphaned_room_ids = list(set(active_message_room_ids) - set(valid_room_ids))
        
        if orphaned_room_ids:
            print(f"  -> Detected orphaned messages from {len(orphaned_room_ids)} ghost rooms.")
            orphan_msg_result = messages_col.delete_many({"roomId": {"$in": orphaned_room_ids}})
            print(f"  -> Shredded {orphan_msg_result.deleted_count} orphaned message records.")

    print("  -> Sweep Complete.")

if __name__ == "__main__":
    print("=== QIX Ephemeral Shredder Online ===")
    database = connect_db()
    
    try:
        while True:
            execute_sweep(database)
            time.sleep(6000)
    except KeyboardInterrupt:
        print("\nShredder safely powered down.")