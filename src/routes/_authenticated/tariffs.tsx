// Тарифы: что включено, сколько пользователей, цена, дополнительные опции.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { db } from "@/integrations/db";
import { adminSetPlan } from "@/lib/billing.functions";
import type { PlanId } from "@/lib/plans";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useBilling } from "@/hooks/use-billing";
import {
  ADDONS,
  ADDON_IDS,
  CUSTOM_WORK_HOUR,
  EXTRA_MEMBER_PRICE,
  PLANS,
  PLAN_IDS,
  limitText,
} from "@/lib/plans";

export const Route = createFileRoute("/_authenticated/tariffs")({
  component: TariffsPage,
  head: () => ({
    meta: [
      { title: "Тарифы и оплата — КабинетCRM" },
      {
        name: "description",
        content:
          "Бесплатный тариф для начала работы и платные тарифы ИП, Бизнес и Опт: пользователи, лимиты и возможности.",
      },
      { property: "og:title", content: "Тарифы и оплата — КабинетCRM" },
      {
        property: "og:description",
        content: "Сравнение тарифов КабинетCRM: цена, число пользователей и что входит в каждый тариф.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const money = (n: number) => `${n.toLocaleString("ru-RU")} ₽`;

function TariffsPage() {
  const { access, usage } = useBilling();
  const qc = useQueryClient();
  const [isAdmin, setIsAdmin] = useState(false);
  const [saving, setSaving] = useState<PlanId | null>(null);
  useEffect(() => {
    db.auth.getUser().then(({ data }) => setIsAdmin(!!(data.user?.user_metadata as any)?.is_admin));
  }, []);

  const switchPlan = async (p: PlanId) => {
    if (!access) return;
    setSaving(p);
    try {
      const res: any = await adminSetPlan({ data: { workspaceId: access.workspaceId, plan: p } });
      if (res?.error) throw new Error(res.error.message);
      toast.success(`Тариф «${PLANS[p].label}» включён`);
      qc.invalidateQueries({ queryKey: ["billing-mine"] });
      qc.invalidateQueries({ queryKey: ["admin-billing"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Не удалось сменить тариф");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Тарифы и оплата</h1>
        <p className="text-xs text-muted-foreground">
          Начните бесплатно, платный тариф выбирайте по числу пользователей и нужным разделам.
        </p>
      </div>

      {isAdmin && (
        <p className="rounded border border-primary/40 bg-primary/5 px-3 py-2 text-xs">
          Вы суперадмин: кнопкой «Включить этот тариф» меняется тариф текущей базы. Тариф любого клиента —
          в <Link to="/admin" className="underline">Админке → Клиенты и оплата</Link>.
        </p>
      )}

      {access && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Ваш тариф: «{access.planLabel}» — {money(access.priceMonth)}/мес
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm md:grid-cols-3">
            <div>
              Оплачено до:{" "}
              <b>{access.paidUntil ? new Date(access.paidUntil).toLocaleDateString("ru-RU") : "—"}</b>
              {access.daysLeft !== null && <span className="text-muted-foreground"> ({access.daysLeft} дн.)</span>}
            </div>
            <div>
              Дополнительные пользователи: <b>{access.extraMembers}</b>
            </div>
            <div>
              Опции:{" "}
              <b>
                {access.addons.length
                  ? access.addons.map((a) => ADDONS[a as keyof typeof ADDONS]?.label ?? a).join(", ")
                  : "нет"}
              </b>
            </div>
            {usage && (
              <>
                <div>Товары: {limitText(usage.products, access.limits.products)}</div>
                <div>Контрагенты: {limitText(usage.partners, access.limits.partners)}</div>
                <div>
                  Документы за месяц: {limitText(usage.docsThisMonth, access.limits.docsPerMonth)}
                </div>
                <div>Пользователи: {limitText(Math.max(usage.members, 1), access.limits.members)}</div>
                <div>Картинки, МБ: {limitText(usage.storageMb, access.limits.storageMb)}</div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {PLAN_IDS.map((p) => {
          const plan = PLANS[p];
          const current = access?.plan === p;
          return (
            <Card key={p} className={current ? "border-primary" : ""}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">{plan.label}</CardTitle>
                  {current && <Badge>Ваш тариф</Badge>}
                </div>
                <div className="text-xl font-semibold">
                  {plan.priceMonth === 0 ? "0 ₽" : `${money(plan.priceMonth)}/мес`}
                </div>
                <p className="text-xs text-muted-foreground">
                  Пользователей: {plan.usersLabel}. {plan.summary}
                </p>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <ul className="space-y-1">
                  {plan.includes.map((t) => (
                    <li key={t} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      <span>{t}</span>
                    </li>
                  ))}
                  {plan.excludes.map((t) => (
                    <li key={t} className="flex items-start gap-2 text-muted-foreground">
                      <X className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
                <div className="border-t pt-2 text-xs text-muted-foreground">
                  Товары: {plan.limits.products ?? "без ограничения"} · Контрагенты:{" "}
                  {plan.limits.partners ?? "без ограничения"} · Документов в месяц:{" "}
                  {plan.limits.docsPerMonth ?? "без ограничения"} · Картинки:{" "}
                  {plan.limits.storageMb} МБ
                </div>
                {isAdmin && access && !current && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    disabled={saving !== null}
                    onClick={() => switchPlan(p)}
                  >
                    {saving === p ? "Сохраняю…" : "Включить этот тариф"}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Дополнительные опции</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <div>Дополнительные пользователи сверх лимита — +{money(EXTRA_MEMBER_PRICE)}/мес за каждого</div>
          {ADDON_IDS.map((a) => (
            <div key={a}>
              {ADDONS[a].label} — +{money(ADDONS[a].priceMonth)}/мес
            </div>
          ))}
          <div>Индивидуальные доработки — от {money(CUSTOM_WORK_HOUR)}/час</div>
          <p className="pt-2 text-xs text-muted-foreground">
            Чтобы сменить тариф или подключить опцию, напишите в поддержку — включим в вашей базе.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
