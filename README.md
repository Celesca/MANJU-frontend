# MANJU: Multi-Agent AI for Natural Just-in-time Understanding

[cite_start]**MANJU** คือแพลตฟอร์ม No-Code AI Agent Builder ที่ช่วยให้คุณออกแบบ Workflow การทำงานของระบบเสียงอัจฉริยะได้ง่ายๆ ผ่านหน้าเว็บ รองรับการสั่งงานด้วยเสียงภาษาไทย (Thai Voice Interaction) เชื่อมต่อกับฐานข้อมูลภายนอก และปรับแต่ง AI Agent ได้ตามต้องการ [cite: 1-3, 23]

![MANJU Banner](src/assets/image_47f7c3.png)

## 🌟 Key Features

* [cite_start]**No-Code Workflow Builder**: ลากและวาง Node คำสั่งต่างๆ เพื่อสร้าง Flow การทำงานของ AI ได้ทันที ไม่ต้องเขียนโค้ด [cite: 491, 503]
* [cite_start]**Real-time Voice Interaction**: รองรับการสนทนาด้วยเสียงแบบเรียลไทม์ (Voice-to-Voice) ด้วยค่า Latency ต่ำ [cite: 16, 25]
* [cite_start]**Multi-Agent System**: ทำงานด้วยระบบ Multi-Agent (Supervisor, Product, Knowledge, General) เพื่อความแม่นยำสูงสุด [cite: 106-113]
* [cite_start]**RAG Integration**: เชื่อมต่อเอกสาร PDF และ Google Sheets เพื่อให้ AI ตอบคำถามจากข้อมูลจริงขององค์กร [cite: 115-117]
* **Customizable AI**: ปรับแต่ง System Prompt, Model, และ Parameter ต่างๆ ได้อย่างอิสระ

## 🛠 Tech Stack

โปรเจกต์นี้พัฒนาโดยใช้เทคโนโลยีที่ทันสมัยเพื่อประสิทธิภาพและความสวยงาม:

* **Core**: React (Vite), TypeScript
* **Styling**: Tailwind CSS (v4), DaisyUI, Emotion, Material UI, Ant Design
* **Animation & 3D**: Framer Motion, Anime.js, GSAP, Three.js, OGL
* **State & Logic**: Axios, Moment.js, Lucide React
* **Backend Communication**: WebSocket, REST API

## 🚀 Getting Started

ทำตามขั้นตอนด้านล่างเพื่อรันโปรเจกต์ในเครื่องของคุณ

### Prerequisites
* Node.js (v18 หรือสูงกว่า)
* npm หรือ yarn

### Installation

1.  **Clone repository**
    ```bash
    git clone [https://github.com/your-username/MANJU-frontend.git](https://github.com/your-username/MANJU-frontend.git)
    cd MANJU-frontend
    ```

2.  **Install Dependencies** (Run these commands)
    
    ติดตั้ง Core Dependencies และ Webpack tools:
    ```bash
    npm install -D typescript @types/react @types/react-dom postcss autoprefixer tailwindcss
    npm i -D daisyui@latest
    ```

    ติดตั้ง Libraries ทั้งหมดที่ใช้ในโปรเจกต์:
    ```bash
    npm install react@^18.3.1 react-dom@^18.3.1 react-router-dom@^6.25.1 \
    @emotion/react@^11.11.4 @emotion/styled@^11.11.0 @mui/material@^5.16.4 antd@^5.29.1 \
    flowbite@^2.3.0 flowbite-react@^0.10.1 animejs@^3.2.2 framer-motion@^11.3.19 \
    gsap@^3.12.5 ogl@^1.0.11 three@^0.166.1 axios@^1.7.2 bcryptjs@^2.4.3 body-parser@^1.20.2 \
    cors@^2.8.5 express@^4.19.2 jsonwebtoken@^9.0.2 mongoose@^8.5.1 multer@^1.4.5-lts.1 \
    mysql2@^3.10.3 node-cron@^3.0.3 @tailwindcss/vite@^4.1.17 browser-image-compression@^2.0.2 \
    cross-env@^7.0.3 lucide-react@^0.379.0 moment@^2.30.1 react-scroll@^1.9.0 \
    react-scroll-to-top@^2.0.0 react-slick@^0.30.2 react-spinners@^0.13.8 \
    react-transition-group@^4.4.5 slick-carousel@^1.8.1 sweetalert2@^11.12.2 swiper@^11.1.8
    ```

3.  **Run Development Server**
    ```bash
    npm run dev
    ```
    เปิด Browser และไปที่ `http://localhost:5173`

## 👥 The Team

[cite_start]โครงงานวิศวกรรมคอมพิวเตอร์ ภาคการศึกษาที่ 1/2568 [cite: 2, 9]
[cite_start]คณะวิศวกรรมศาสตร์ มหาวิทยาลัยเทคโนโลยีพระจอมเกล้าธนบุรี (KMUTT) [cite: 1]

| Name | Role | Socials |
| :--- | :--- | :--- |
| **Sawit Koseeyaumporn** (Folk) | AI Engineer / MLOps | [GitHub](https://github.com/crazyfolkza) |
| **Siratee Saiprom** (Oat) | Full-Stack Developer | [GitHub](https://github.com/SOtwoX1) |
| **Punchaya Chancharoen** (Pang) | Frontend / UX/UI | [GitHub](https://github.com/Kaewkloaw) |

---
*© 2025 MANJU Project. All Rights Reserved.*