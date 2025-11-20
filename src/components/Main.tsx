import React from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Pagination, Autoplay } from "swiper/modules";

// Swiper CSS
const Mainpage: React.FC = () => {
    const team = [
        {
            name: "John Doe",
            role: "Voice Actor",
            img: "[https://placekitten.com/350/420](https://placekitten.com/350/420)",
            desc: "Professional sound talent specializing in emotional delivery.",
        },
        {
            name: "Sarah Lee",
            role: "Voice Artist",
            img: "[https://placekitten.com/351/420](https://placekitten.com/351/420)",
            desc: "Clear tone, excellent for narration and academic speaking.",
        },
        {
            name: "Folk",
            role: "Voice Sound",
            img: "[https://placekitten.com/352/420](https://placekitten.com/352/420)",
            desc: "Deep character voice suitable for storytelling and AI dialogue.",
        },
    ];

    return (
<>
    <div className="w-full">

        ```
        {/* =====================================================
      HERO SECTION
  ===================================================== */}
        <section className="w-full min-h-[450px] bg-gradient-to-b from-[#0a0d24] to-[#061042] text-white flex items-center px-10 py-10 relative overflow-hidden">
            <div className="max-w-3xl z-10">
                <h1 className="text-4xl font-bold leading-tight mb-4">
                    MANJU – Real-time Voice<br />Chatbot
                </h1>
                <p className="text-lg opacity-80 mb-6">
                    A high-performance, multi-agent voice chatbot based on real-time deep-learning speech interactions.
                </p>
                <button className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg">
                    Try Now
                </button>
            </div>

            {/* Cute character image */}
            <img
                src="/images/cute-mascot.png"
                alt="hero mascot"
                className="absolute right-10 bottom-0 h-72 object-contain"
            />
        </section>

        {/* =====================================================
      VOICE CHATBOT SECTION
  ===================================================== */}
        <section className="w-full py-10">
            <h2 className="text-2xl font-bold px-10 mb-6">Voice Chatbot</h2>

            <Swiper
                modules={[Navigation, Pagination, Autoplay]}
                navigation
                pagination={{ clickable: true }}
                autoplay={{ delay: 2500 }}
                spaceBetween={20}
                slidesPerView={2}
                className="px-10"
                breakpoints={{
                    1024: { slidesPerView: 3 },
                    640: { slidesPerView: 2 },
                    0: { slidesPerView: 1 },
                }}
            >
                {team.map((m, idx) => (
                    <SwiperSlide key={idx}>
                        <div className="bg-white rounded-xl shadow-md overflow-hidden">
                            <img src={m.img} className="w-full h-60 object-cover" />

                            <div className="p-4">
                                <h3 className="font-bold text-lg">{m.name}</h3>
                                <p className="text-sm text-gray-500">{m.role}</p>
                                <p className="mt-2 text-sm opacity-80 leading-snug">
                                    {m.desc}
                                </p>
                            </div>
                        </div>
                    </SwiperSlide>
                ))}
            </Swiper>
        </section>
    </div>
</>    );
}

export default Mainpage;
