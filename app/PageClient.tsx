"use client";
import dynamic from "next/dynamic";
const PlateEditor = dynamic(() => import("./PlateEditor"), { ssr: false });
export default function PageClient(){ return <PlateEditor />; }
