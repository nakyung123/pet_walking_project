# Pet Territory API 명세서

## 공통 응답 구조

```json
{
  "success": true,
  "data": {},
  "error": null
}
```

---

## 1. 헬스 체크

**GET** `/health`

응답:
```json
{ "success": true, "data": { "status": "ok" }, "error": null }
```

---

## 2. 마킹 (Marking)

**POST** `/api/marking`

Headers: `Authorization: Bearer <Firebase ID Token>`

Request Body:
```json
{
  "userId": "firebase_uid",
  "lat": 37.5665,
  "lng": 126.9780,
  "speed": 3.5,
  "timestamp": "2026-04-05T10:00:00Z"
}
```

Response (성공):
```json
{
  "success": true,
  "data": {
    "tileId": "123456_789012",
    "newScore": 5,
    "isOccupied": true
  },
  "error": null
}
```

Response (속도 초과):
```json
{
  "success": false,
  "data": null,
  "error": "이동 속도(20km/h)가 15km/h를 초과하여 마킹이 거부되었습니다."
}
```

---

## 3. 타일 조회 (Tiles)

**GET** `/api/tiles?minLat=&maxLat=&minLng=&maxLng=`

Headers: `Authorization: Bearer <Firebase ID Token>`

Query Parameters:
- `minLat`: 최소 위도
- `maxLat`: 최대 위도
- `minLng`: 최소 경도
- `maxLng`: 최대 경도

Response:
```json
{
  "success": true,
  "data": [
    {
      "tileId": "123456_789012",
      "lat": 37.5665,
      "lng": 126.9780,
      "occupantUserId": "firebase_uid",
      "occupancyScore": 5
    }
  ],
  "error": null
}
```
