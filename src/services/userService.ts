// src/services/userService.ts
import { prisma } from "@/src/lib/prisma";

// 반드시 'export'를 붙여야 다른 파일(route.ts)에서 가져다 쓸 수 있습니다!
export const UserService = {
  async getAllUsers() {
    return await prisma.user.findMany();
  },
};