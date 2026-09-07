import { NextResponse } from "next/server";
import { buildSkillFromForm, listSkills, saveSkill, type SkillFormInput } from "@/lib/server/workflows";

export async function GET() {
  try {
    const skills = listSkills();
    return NextResponse.json({ skills });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as SkillFormInput;
    const { skill, yamlText } = buildSkillFromForm(input);
    saveSkill(skill, yamlText);
    return NextResponse.json({ skill, yamlText }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }
}
