from fastapi.testclient import TestClient
from main import app  # Import ตัว App ของเรามา

# สร้าง "ปืน" สำหรับยิง API (Client จำลอง)
client = TestClient(app)

# Test 1: ยิงไปที่หน้าแรก (Health Check)
def test_read_root():
    # สั่งยิง GET ไปที่ "/"
    response = client.get("/")
    
    # ตรวจสอบผลลัพธ์ (Assert)
    assert response.status_code == 200  # ต้องตอบ 200 OK
    assert response.json() == {"status": "ok"} # (แก้ตรงนี้ให้ตรงกับข้อความจริงของคุณ)

# Test 2: ลองยิง Chat (แบบ Mock ไม่ต้องใช้ OpenAI จริง)
def test_chat_endpoint():
    # ข้อมูลที่จะส่ง
    payload = {
        "message": "สวัสดี",
        "user_id": "test_user"
    }
    
    # สั่งยิง POST ไปที่ "/chat" (หรือ path ที่คุณตั้งไว้)
    response = client.post("/chat", json=payload)
    
    # เช็คว่า Server ไม่พัง
    assert response.status_code == 200
    # เช็คว่ามีคำตอบกลับมา
    assert "reply" in response.json()