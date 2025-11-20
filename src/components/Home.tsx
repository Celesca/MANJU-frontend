import React, { useEffect, useState } from "react";
import { Button, Menu, Drawer } from "antd";
import { MenuOutlined } from "@ant-design/icons";
import { motion } from "framer-motion";
import axios from "axios";
import { Link } from "react-router-dom";
import ScrollToTop from "react-scroll-to-top";

// Swiper imports (V11+)
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Pagination, Navigation } from "swiper/modules";

// Swiper CSS
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";

type Feature = {
  id: number;
  title: string;
  description: string;
};

const demoFeatures: Feature[] = [
  {
    id: 1,
    title: "Fast & Modern",
    description: "Built with Vite + React + TypeScript for top performance.",
  },
  {
    id: 2,
    title: "Beautiful UI",
    description: "Using Ant Design, Flowbite and MUI components.",
  },
  {
    id: 3,
    title: "Animations",
    description: "Framer Motion + GSAP for delightful micro-interactions.",
  },
];

export default function Home(): JSX.Element {
  const [open, setOpen] = useState(false);
  const [features, setFeatures] = useState<Feature[]>(demoFeatures);

  useEffect(() => {
    let mounted = true;

    axios
      .get("/api/home/featured")
      .then((res) => {
        if (!mounted) return;
        if (Array.isArray(res.data)) {
          setFeatures(
            res.data.map((f: any, i: number) => ({
              id: i + 1,
              title: f.title || "Feature",
              description: f.description || "",
            }))
          );
        }
      })
      .catch(() => {
        // ignore
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 text-gray-900">
      {/* Header */}
      <header className="w-full bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Link to="/" className="text-xl font-bold tracking-tight">
                <span className="text-indigo-600">Manju</span>
                <span className="ml-1 text-sm text-gray-500">Frontend</span>
              </Link>

              <nav className="hidden md:flex items-center gap-6 ml-6">
                <Link to="/features" className="hover:text-indigo-600">
                  Features
                </Link>
                <Link to="/pricing" className="hover:text-indigo-600">
                  Pricing
                </Link>
                <Link to="/docs" className="hover:text-indigo-600">
                  Docs
                </Link>
              </nav>
            </div>

            <div className="flex items-center gap-3">
              <Button type="primary" shape="round">
                Sign up
              </Button>
              <Button
                onClick={() => setOpen(true)}
                icon={<MenuOutlined />}
                className="md:hidden"
              />
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Drawer */}
      <Drawer placement="right" onClose={() => setOpen(false)} open={open}>
        <Menu selectable={false}>
          <Menu.Item>
            <Link to="/features">Features</Link>
          </Menu.Item>
          <Menu.Item>
            <Link to="/pricing">Pricing</Link>
          </Menu.Item>
          <Menu.Item>
            <Link to="/docs">Docs</Link>
          </Menu.Item>
        </Menu>
      </Drawer>

      {/* Hero Section */}
      <main className="flex-grow">
        <section className="bg-gradient-to-br from-white to-indigo-50">
          <div className="max-w-7xl mx-auto px-4 py-16 sm:px-6 lg:py-24 lg:px-8 flex flex-col lg:flex-row items-center gap-12">
            <div className="lg:w-1/2">
              <motion.h1
                initial={{ y: -10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.6 }}
                className="text-4xl font-extrabold sm:text-5xl"
              >
                Build beautiful, fast web apps with{" "}
                <span className="text-indigo-600">React + TypeScript</span>
              </motion.h1>

              <motion.p
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.12 }}
                className="mt-6 text-lg text-gray-700"
              >
                Starter homepage built for Vite. Uses Ant Design, Flowbite
                components, Framer Motion for animation, Swiper for a
                touch-friendly carousel and more.
              </motion.p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Button type="primary" size="large">
                  Get started
                </Button>
                <Button type="default" size="large">
                  Live demo
                </Button>
              </div>
            </div>

            {/* Swiper Carousel */}
            <div className="lg:w-1/2 w-full">
              <div className="rounded-2xl overflow-hidden shadow-lg">
                <Swiper
                  modules={[Autoplay, Pagination, Navigation]}
                  slidesPerView={1}
                  loop
                  autoplay={{ delay: 3800 }}
                  pagination={{ clickable: true }}
                  navigation
                >
                  <SwiperSlide>
                    <div className="h-64 sm:h-80 lg:h-96 bg-gradient-to-r from-indigo-500 to-indigo-300 flex items-center justify-center text-white px-8 text-center">
                      <h3 className="text-2xl font-bold">
                        Ready-made components
                      </h3>
                      <p className="mt-2">
                        Plug in Ant Design or Flowbite components and iterate
                        quickly.
                      </p>
                    </div>
                  </SwiperSlide>

                  <SwiperSlide>
                    <div className="h-64 sm:h-80 lg:h-96 bg-gradient-to-r from-green-400 to-blue-400 flex items-center justify-center text-white px-8 text-center">
                      <h3 className="text-2xl font-bold">
                        Fast builds with Vite
                      </h3>
                      <p className="mt-2">
                        Instant HMR and optimized production bundles.
                      </p>
                    </div>
                  </SwiperSlide>

                  <SwiperSlide>
                    <div className="h-64 sm:h-80 lg:h-96 bg-gradient-to-r from-pink-500 to-yellow-400 flex items-center justify-center text-white px-8 text-center">
                      <h3 className="text-2xl font-bold">
                        Animations & Microinteractions
                      </h3>
                      <p className="mt-2">
                        Delight users with motion and subtle feedback.
                      </p>
                    </div>
                  </SwiperSlide>
                </Swiper>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-center">Features</h2>
            <p className="mt-2 text-center text-gray-600 max-w-2xl mx-auto">
              A curated set of features to help you ship faster.
            </p>

            <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((f) => (
                <motion.div
                  key={f.id}
                  whileHover={{ scale: 1.03 }}
                  className="p-6 bg-white rounded-2xl shadow-sm border"
                >
                  <h3 className="text-xl font-semibold">{f.title}</h3>
                  <p className="mt-2 text-gray-600">{f.description}</p>
                  <div className="mt-4">
                    <Button type="link">Learn more →</Button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="bg-indigo-700 text-white py-12">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <h3 className="text-2xl font-bold">Ready to build?</h3>
            <p className="mt-2">
              Start your project with this starter homepage and the libraries
              you installed.
            </p>

            <div className="mt-6 flex justify-center gap-4">
              <Button type="default">Contact Sales</Button>
              <Button type="primary">Start Trial</Button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t">
        <div className="max-w-7xl mx-auto px-4 py-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-sm text-gray-600">
            © {new Date().getFullYear()} Manju — Built with ❤️
          </div>

          <div className="flex items-center gap-4">
            <a className="hover:text-indigo-600">Privacy</a>
            <a className="hover:text-indigo-600">Terms</a>
          </div>
        </div>
      </footer>

      {/* Scroll-To-Top Button */}
      <ScrollToTop smooth />
    </div>
  );
}
