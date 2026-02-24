# ADR-012: UI Component Library Strategy

**Status:** ✅ Accepted
**Date:** 2026-02-24
**Decision Makers:** Frontend Team, UX Designer
**Related Documents:** [Frontend Guidelines](../05-Engineering-Guidelines/05-03-frontend-guidelines.md), [ADR-005: Technology Stack](./ADR-005-technology-stack.md)

---

## Context and Problem Statement

ต้องการ UI Component Library สำหรับสร้าง User Interface ที่สวยงาม สม่ำเสมอ และ Accessible

### ปัญหาที่ต้องแก้:

1. **Component Library:** ใช้ Library สำเร็จรูป หรือสร้างเอง
2. **Customization:** ปรับแต่งได้ง่ายเพียงใด
3. **Accessibility:** รองรับ ARIA และ Keyboard navigation
4. **Bundle Size:** ขนาดไฟล์ไม่ใหญ่เกินไป
5. **Developer Experience:** ใช้งานง่าย Documentation ครบ

---

## Decision Drivers

- 🎨 **Design Consistency:** UI สม่ำเสมอทั้งระบบ
- ♿ **Accessibility:** รองรับ WCAG 2.1 AA
- 🎯 **Customization:** ปรับแต่งได้ตามต้องการ
- 📦 **Bundle Size:** เล็กและ Tree-shakeable
- ⚡ **Performance:** Render เร็ว
- 🛠️ **DX:** Developer Experience ดี

---

## Considered Options

### Option 1: Material-UI (MUI)

**Pros:**

- ✅ Component ครบชุด
- ✅ Documentation ดี
- ✅ Community ใหญ่
- ✅ Built-in theming

**Cons:**

- ❌ Bundle size ใหญ่
- ❌ Design opinionated (Material Design)
- ❌ Customization ยาก
- ❌ Performance overhead

### Option 2: Ant Design

**Pros:**

- ✅ Component ครบ (เน้น Enterprise)
- ✅ i18n support ดี
- ✅ Form components ครบ

**Cons:**

- ❌ Bundle size ใหญ่มาก
- ❌ Chinese-centric design
- ❌ Customization จำกัด
- ❌ TypeScript support ไม่ดีเท่าไร

### Option 3: Chakra UI

**Pros:**

- ✅ Accessibility ดี
- ✅ Customization ง่าย
- ✅ TypeScript first
- ✅ Dark mode built-in

**Cons:**

- ❌ Bundle size ค่อนข้างใหญ่
- ❌ CSS-in-JS overhead
- ❌ Performance issues with many components

### Option 4: Headless UI + Tailwind CSS

**Pros:**

- ✅ Full control over styling
- ✅ Lightweight
- ✅ Accessibility ดี
- ✅ No styling overhead

**Cons:**

- ❌ ต้องเขียน styles เอง
- ❌ Component library น้อย
- ❌ ใช้เวลาพัฒนานาน

### Option 5: Shadcn/UI + Tailwind CSS

**วิธีการ:** Copy components ที่ต้องการไปยัง Project

**Pros:**

- ✅ **Full ownership:** Components เป็นของเรา ไม่ใช่ dependency
- ✅ **Highly customizable:** แก้ไขได้เต็มที่
- ✅ **Accessibility:** ใช้ Radix UI Primitives
- ✅ **Bundle size:** เฉพาะที่ใช้เท่านั้น
- ✅ **Tailwind CSS:** Utility-first ง่ายต่อการ maintain
- ✅ **TypeScript:** Type-safe
- ✅ **Beautiful defaults:** Design ดูทันสมัย

**Cons:**

- ❌ ต้อง Copy components เอง
- ❌ Update ต้องทำด้วยตัวเอง
- ❌ ไม่มี `npm install` แบบ Library

---

## Decision Outcome

**Chosen Option:** **Option 5 - Shadcn/UI + Tailwind CSS**

### Rationale

1. **Ownership:** เป็นเจ้าของ Code 100% ปรับแต่งได้อย่างเต็มที่
2. **Bundle Size:** เล็กที่สุด (เฉพาะที่ใช้)
3. **Accessibility:** ใช้ Radix UI primitives ที่ทดสอบแล้ว
4. **Customization:** แก้ไขได้ตามต้องการ ไม่ติด Framework
5. **Tailwind CSS:** ทีมคุ้นเคยและใช้อยู่แล้ว
6. **Modern Design:** ดูสวยงามและทันสมัย

---

## Implementation Details

### 1. Setup Shadcn/UI

```bash
# Initialize shadcn/ui
npx shadcn-ui@latest init

# Select options:
# - TypeScript: Yes
# - Style: Default
# - Base color: Slate
# - CSS variables: Yes
```

```typescript
// File: components.json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.js",
    "css": "app/globals.css",
    "baseColor": "slate",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils"
  }
}
```

### 2. Add Components

```bash
# Add specific components
npx shadcn-ui@latest add button
npx shadcn-ui@latest add input
npx shadcn-ui@latest add card
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add dropdown-menu
npx shadcn-ui@latest add table

# Components will be copied to components/ui/
```

### 3. Component Usage

```typescript
// File: app/correspondences/page.tsx
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export default function CorrespondencesPage() {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Input placeholder="Search..." className="max-w-sm" />
        <Button>Create New</Button>
      </div>

      <Card className="p-6">
        <h2 className="text-xl font-bold">Correspondences</h2>
        {/* Content */}
      </Card>
    </div>
  );
}
```

### 4. Customize Components

```typescript
// File: components/ui/button.tsx
// สามารถแก้ไขได้เต็มที่เพราะเป็น Code ของเรา

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-background hover:bg-accent',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
        // Add custom variant
        success: 'bg-green-600 text-white hover:bg-green-700',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
```

### 5. Theming with CSS Variables

```css
/* File: app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --primary: 221.2 83.2% 53.3%;
    --primary-foreground: 210 40% 98%;
    /* ... more colors */
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    /* ... dark mode colors */
  }
}
```

### 6. Component Composition

```typescript
// File: components/correspondence/card.tsx
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export function CorrespondenceCard({ correspondence }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <CardTitle>{correspondence.subject}</CardTitle>
          <Badge
            variant={
              correspondence.status === 'APPROVED' ? 'success' : 'default'
            }
          >
            {correspondence.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          {correspondence.description}
        </p>
        <div className="mt-4 flex gap-2">
          <Button variant="outline" size="sm">
            View
          </Button>
          <Button size="sm">Edit</Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

---

## Component Inventory

### Core Components (มีอยู่ใน Shadcn/UI)

**Forms:**

- Button
- Input
- Textarea
- Select
- Checkbox
- Radio Group
- Switch
- Slider
- Label

**Data Display:**

- Table
- Card
- Badge
- Avatar
- Separator

**Feedback:**

- Alert
- Dialog
- Toast
- Progress
- Skeleton

**Navigation:**

- Tabs
- Dropdown Menu
- Command
- Popover
- Sheet (Drawer)

**Layout:**

- Accordion
- Collapsible
- Aspect Ratio
- Scroll Area

---

## Consequences

### Positive Consequences

1. ✅ **Full Control:** แก้ไข Components ได้เต็มที่
2. ✅ **Smaller Bundle:** เฉพาะที่ใช้เท่านั้น
3. ✅ **No Lock-in:** ไม่ติด Dependency
4. ✅ **Accessibility:** ใช้ Radix UI (tested)
5. ✅ **Beautiful Design:** ดูทันสมัยและสวยงาม
6. ✅ **TypeScript:** Type-safe

### Negative Consequences

1. ❌ **Manual Updates:** ต้อง Update components ด้วยตัวเอง
2. ❌ **Initial Setup:** ต้อง Copy components ที่ต้องการ
3. ❌ **No Official Support:** ไม่มี Package maintainer

### Mitigation Strategies

- **Documentation:** เขียนเอกสารว่า Components ไหนมา version ไหน
- **Changelog:** Track changes ที่ทำกับ Components
- **Testing:** เขียน Tests สำหรับ Custom components
- **Review Updates:** Check Shadcn/UI releases เป็นระยะ (แนะนำให้ใช้ `npx shadcn-ui@latest diff` ตรวจสอบความแตกต่างทุกๆ X เดือนเพื่อลดภาระการอัปเดตแบบ manual)

---

## Related ADRs

- [ADR-005: Technology Stack](./ADR-005-technology-stack.md) - เลือกใช้ Tailwind CSS
- [ADR-011: Next.js App Router](./ADR-011-nextjs-app-router.md)

---

## References

- [Shadcn/UI Documentation](https://ui.shadcn.com/)
- [Radix UI Primitives](https://www.radix-ui.com/)
- [Tailwind CSS](https://tailwindcss.com/)

---

**Last Updated:** 2025-12-01
**Next Review:** 2026-06-01
