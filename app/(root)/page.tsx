"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  ArrowBigRightIcon,
  CalendarRange,
  CopyCheck,
  NotebookPen,
  ScrollText,
  Wallet,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { motion, useInView, easeInOut, backOut } from "framer-motion";
import { useRef } from "react";

export default function Home() {
  const refFeatures = useRef(null);
  const isFeaturesInView = useInView(refFeatures, { once: true, amount: 0.2 });
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.2,
        ease: easeInOut,
      },
    },
  };

  const iconVariants = {
    hidden: { opacity: 0, scale: 0.9 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.3,
        ease: backOut,
      },
    },
  };

  return (
    <div>
      {/* Main */}
      <section
        id="#"
        className="bg-main min-h-[90vh] flex flex-col justify-center items-center text-center px-6"
      >
        <h1 className="flex flex-col items-center gap-6 leading-tight">
          <span className="text-7xl md:text-8xl font-bold animate-text-movement-3">
            UD
          </span>
          <span className="text-2xl md:text-3xl font-semibold tracking-wide">
            Your Daily
          </span>

          <p className="text-lg md:text-xl tracking-wide max-w-xl">
            is where you can track your life
          </p>
        </h1>

        <Link href="#features">
          <Button
            size="lg"
            className="mt-10 px-8 py-6 text-lg"
            variant={"secondary"}
          >
            Discover All Features
          </Button>
        </Link>
      </section>

      {/* Text  */}
      <section
        id="features"
        className="grid xl:grid-cols-2 p-5"
        ref={refFeatures}
      >
        <motion.div
          className="md:w-2/4 m-auto p-5 space-y-5"
          variants={containerVariants}
          animate={isFeaturesInView ? "visible" : "hidden"}
          initial="hidden"
        >
          <motion.div className="space-y-5" variants={itemVariants}>
            <h2 className="text-3xl md:text-4xl font-bold">
              All tools in one place
            </h2>
            <p className="text-lg text-muted-foreground">
              Lorem ipsum dolor sit amet consectetur adipisicing elit. Placeat,
              amet excepturi molestias reprehenderit consequatur aliquam saepe
              magnam voluptate non dicta perferendis reiciendis, unde vitae,
              repellat perspiciatis quo ipsum quos fuga.
            </p>
          </motion.div>
          <motion.div className="space-y-5" variants={itemVariants}>
            <h2>Use with mind</h2>
            <p>
              Lorem ipsum dolor sit amet consectetur adipisicing elit. Placeat,
              amet excepturi molestias reprehenderit consequatur aliquam saepe
              magnam voluptate non dicta perferendis reiciendis, unde vitae,
              repellat perspiciatis quo ipsum quos fuga..
            </p>
          </motion.div>
          <Link href="#">
            <p className="flex items-center gap-2 group cursor-pointer group-hover:bg-primary">
              <span className="inline-block border-b-2 border-primary group-hover:bg-primary transition-all duration-300">
                Learn more
              </span>
              <ArrowBigRightIcon className="group-hover:translate-x-1 transition-all duration-300" />
            </p>
          </Link>
        </motion.div>

        {/* ICON AREA */}
        <motion.div
          className="grid grid-cols-2 sm:grid-cols-3 2xl:grid-cols-5 gap-8 p-5 place-items-center"
          variants={containerVariants}
          initial="hidden"
          animate={isFeaturesInView ? "visible" : "hidden"}
        >
          {[
            { Icon: Wallet, label: "Your Income & Outcome" },
            { Icon: CopyCheck, label: "Your To-Do List" },
            { Icon: CalendarRange, label: "Your Weekly Events List" },
            { Icon: NotebookPen, label: "Your Notes" },
            { Icon: ScrollText, label: "Your Inspirations" },
          ].map(({ Icon, label }, index) => (
            <motion.div
              key={label}
              variants={iconVariants}
              custom={index}
              className="
                flex flex-col items-center text-center
                gap-3 p-4 rounded-xl
                transition-all duration-300
                hover:scale-115 hover:-translate-y-1
                hover:bg-card
              "
            >
              <motion.div
                whileHover={{ rotate: 5, scale: 1.1 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <Icon className="w-[clamp(40px,5vw,70px)] h-[clamp(40px,5vw,70px)]" />
              </motion.div>
              <h3 className="text-sm sm:text-base md:text-lg leading-tight">
                {label}
              </h3>
            </motion.div>
          ))}
        </motion.div>
      </section>

      <div className="relative flex items-center justify-center p-8">
        {/* Left line */}
        <div className="absolute left-0 top-1/2 h-1 w-2/4 bg-primary" />

        <Button
          size="lg"
          className="relative px-8 py-6 text-lg z-10 shadow-xl/30 shadow-primary hover:shadow-2xl"
          asChild
        >
          <Link href="/account">Login/Registration</Link>
        </Button>

        {/* Right line */}
        <div className="absolute right-0 top-1/2 h-1 w-2/4 bg-primary" />
      </div>

      <section className="flex flex-col md:flex-row justify-around items-center gap-10 p-10">
        {/* Marcus Aurelius Card */}
        <div className="card relative h-80 md:h-100 w-60 md:w-80">
          {/* FRONT */}
          <Card className="card__side card__side--front absolute inset-0 overflow-hidden">
            <Image
              alt="marcus-aurelius"
              src="/main/ancient-rome.jpg"
              fill
              className="object-cover blur-sm"
            />
            <div className="relative z-10 p-5 h-full flex flex-col">
              <CardHeader className="text-2xl font-bold">
                Marcus Aurelius
              </CardHeader>
              <CardContent className="mt-5 text-lg italic wrap-break-word">
                You have power over your mind — not outside events. Realize
                this, and you will find strength.
              </CardContent>
            </div>
          </Card>

          {/* BACK */}
          <Card
            className="card__side card__side--back absolute inset-0 
            flex items-center justify-center text-white p-6"
          >
            <div className="text-center">
              <h3 className="text-2xl font-bold mb-4">Meaning</h3>
              <p className="text-lg">
                Focus on what you can control (your mind) rather than external
                circumstances to find inner strength.
              </p>
              <div className="mt-6">
                <p className="font-semibold">121 AD - 180 AD</p>
                <p className="text-sm mt-1">
                  Roman Emperor & Stoic Philosopher
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Epictetus Card */}
        <div className="card relative h-80 md:h-100 w-60 md:w-80">
          {/* FRONT */}
          <Card className="card__side card__side--front absolute inset-0 overflow-hidden">
            <Image
              alt="epictetus"
              src="/main/ancient-rome.jpg"
              fill
              className="object-cover blur-sm grayscale-50"
            />
            <div className="relative z-10 p-5 h-full flex flex-col">
              <CardHeader className="text-2xl font-bold">Epictetus</CardHeader>
              <CardContent className="mt-5 text-lg italic">
                First say to yourself what you would be; and then do what you
                have to do.
              </CardContent>
            </div>
          </Card>

          {/* BACK */}
          <Card
            className="card__side card__side--back absolute inset-0 
            flex items-center justify-center text-white p-6"
          >
            <div className="text-center">
              <h3 className="text-2xl font-bold mb-4">Meaning</h3>
              <p className="text-lg">
                Define your character and purpose first, then take consistent
                action toward that vision.
              </p>
              <div className="mt-6">
                <p className="font-semibold">50 AD - 135 AD</p>
                <p className="text-sm mt-1">Greek Stoic Philosopher</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Seneca Card  */}
        <div className="card relative h-80 md:h-100 w-60 md:w-80">
          {/* FRONT */}
          <Card className="card__side card__side--front absolute inset-0 overflow-hidden">
            <Image
              alt="ancient-rome"
              src="/main/ancient-rome.jpg"
              fill
              className="object-cover blur-sm grayscale"
            />
            <div className="relative z-10 p-5 h-full flex flex-col">
              <CardHeader className="text-2xl font-bold">Seneca</CardHeader>
              <CardContent className="mt-5 text-lg italic">
                Difficulties strengthen the mind, as labor does the body.
              </CardContent>
            </div>
          </Card>

          {/* BACK */}
          <Card
            className="card__side card__side--back absolute inset-0 
              flex items-center justify-center text-white p-6"
          >
            <div className="text-center">
              <h3 className="text-2xl font-bold mb-4">Meaning</h3>
              <p>
                Hardship builds mental resilience just like exercise builds
                muscles.
              </p>
              <div className="mt-6">
                <p className="font-semibold">4 BC - 65 AD</p>
                <p className="text-sm mt-1">Roman Stoic Philosopher</p>
              </div>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}
