import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { prisma } from "@/app/lib/db";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { name, email, password } = body;

        if (!name || !email || !password) {
            return NextResponse.json (
                { error: "Name, email, and Password are required" },
                { status: 400 } 
            )
        }

        const existingUser = await prisma.user.findUnique({
            where: {email},
        });

        if (existingUser) {
            return NextResponse.json(
                { error: "User already exists with this email. Please try a different email" },
                { status: 400 } 
            )
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: {
                name,
                email,
                passwordHash,
            },
        });

        return NextResponse.json(
            {
                message: "User registered successfully.",
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                },
            },
            { status: 201}
        )

    } catch(error) {
        console.error("Register error:", error);

        return NextResponse.json(
            { error: "Something went wrong during registration." },
            { status: 500 }
        )
    }
} 