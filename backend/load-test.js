import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

const responseTime = new Trend('response_time');

const TOKEN = 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjJiMzZhYjQxYTczOTJlMTRlNjM1ZmRlM2M2YWYwOWZlYmFhM2YyZDYiLCJ0eXAiOiJKV1QifQ.eyJuYW1lIjoi7LWc7Jyk7ISxIiwicGljdHVyZSI6Imh0dHBzOi8vbGgzLmdvb2dsZXVzZXJjb250ZW50LmNvbS9hL0FDZzhvY0prZldoQ01uc1ZPUEwzUVNaZWVnYklqWHJ6TFBndk1yOEhReDRYTkZqR3BJTk5yWnc9czk2LWMiLCJpc3MiOiJodHRwczovL3NlY3VyZXRva2VuLmdvb2dsZS5jb20vcGV0LXRlcnJpdG9yeS1jOTZmOSIsImF1ZCI6InBldC10ZXJyaXRvcnktYzk2ZjkiLCJhdXRoX3RpbWUiOjE3Nzc3MTAyODYsInVzZXJfaWQiOiJVcm1VZ0t5SThTT0FYbE1qTU5zNXZVaGxsMHAyIiwic3ViIjoiVXJtVWdLeUk4U09BWGxNak1OczV2VWhsbDBwMiIsImlhdCI6MTc3NzcxMDI4NiwiZXhwIjoxNzc3NzEzODg2LCJlbWFpbCI6InpweG1ybDEyMzQ1QGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJmaXJlYmFzZSI6eyJpZGVudGl0aWVzIjp7Imdvb2dsZS5jb20iOlsiMTE2NjMyODgxNzIzMzE1MDA2NTU2Il0sImVtYWlsIjpbInpweG1ybDEyMzQ1QGdtYWlsLmNvbSJdfSwic2lnbl9pbl9wcm92aWRlciI6Imdvb2dsZS5jb20ifX0.aG-ErPKqKPBe7rui8jgAKJz7CbxlthCjpt05HbMjWE_1B1xym8nEfToN8_UpItWXPI8MH5T_5k5HG1qhmKtgRXSopSq50f7p8ZQAch92HgRY5xNIUHN7w_8JkLB_bNtAPzhUROzU2S2VbFQkbskbhLXVSSJam6ZJvUtbj8ty1RgpD3dadQNDliHGilmEPxkeZ4e_xWvTQAQaueKaZYcaSutyQ6i9VhoMbyQLOt_n3dFFVjVxld5B8Ahp4ogY-tSerpj_a_l7x6oP3qeEDJwwwL-1sMc_WKQuYMRSy88OHPPEu8hJxfa4Y2TwESLUE3R0h-PYWuto08yck8CR9wks8Q';

export const options = {
  stages: [
    { duration: '20s', target: 50 },   // 20초 동안 50명까지 증가
    { duration: '30s', target: 100 },  // 30초 동안 100명까지 증가
    { duration: '20s', target: 100 },  // 20초 동안 100명 유지
    { duration: '10s', target: 0 },    // 10초 동안 0명으로 감소
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'], // 95%의 요청이 1000ms 이내
    http_req_failed: ['rate<0.01'],    // 실패율 1% 이하
  },
};

export default function () {
  const res = http.get('https://petwalkingproject-production.up.railway.app/api/users/me/score', {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });

  responseTime.add(res.timings.duration);

  check(res, {
    '200 응답': (r) => r.status === 200,
    '응답시간 500ms 이하': (r) => r.timings.duration < 500,
  });

  sleep(1);
}
