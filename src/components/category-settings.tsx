"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Pencil,
  Plus,
  Search,
  Tags,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "./ui/button";

type Category = { id: string; name: string; type: "income" | "expense" };
const schema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Escribe el nombre de la categoría.")
    .max(120, "Usa como máximo 120 caracteres."),
  type: z.enum(["income", "expense"]),
});
type Values = z.infer<typeof schema>;
const normalized = (value: string) =>
  value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("es");

export function CategorySettings({
  categories,
  onChanged,
}: {
  categories: Category[];
  onChanged: () => Promise<void>;
}) {
  const [editor, setEditor] = useState<{ id?: string } | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const {
    register,
    handleSubmit,
    reset,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", type: "expense" },
  });
  const begin = (type: Category["type"], category?: Category) => {
    reset({ name: category?.name ?? "", type });
    setEditor(category ? { id: category.id } : {});
    setError("");
    setSuccess("");
    setTimeout(() => setFocus("name"), 0);
  };
  const groups = [
    {
      type: "income" as const,
      title: "Ingresos",
      badge: "Ingreso",
      description:
        "Dinero que recibes. Por ejemplo: sueldo, ventas o trabajos independientes.",
      icon: ArrowDownLeft,
    },
    {
      type: "expense" as const,
      title: "Egresos",
      badge: "Egreso · Gasto",
      description:
        "Dinero que gastas. Por ejemplo: alimentación, transporte o servicios.",
      icon: ArrowUpRight,
    },
  ];
  return (
    <section
      className="card category-settings"
      aria-labelledby="categories-title"
    >
      <div className="card-head">
        <div>
          <h2 id="categories-title">Categorías de ingresos y egresos</h2>
          <p>Organiza tus movimientos con tus propias categorías.</p>
        </div>
        <Button onClick={() => begin("expense")} disabled={isSubmitting}>
          <Plus size={15} />
          Nueva categoría
        </Button>
      </div>
      <p className="detail" style={{ marginBottom: 20 }}>
        Aquí puedes verlas, agregar otras y editar sus nombres. Se usarán en el
        asistente y el registro manual; las de egresos también se usan en los
        presupuestos.
      </p>
      {editor && (
        <form
          className="category-editor"
          aria-label={editor.id ? "Editar categoría" : "Crear categoría"}
          noValidate
          onSubmit={handleSubmit(async (values) => {
            setError("");
            setSuccess("");
            if (
              categories.some(
                (c) =>
                  c.id !== editor.id &&
                  c.type === values.type &&
                  normalized(c.name) === normalized(values.name),
              )
            ) {
              setError(
                "Ya tienes una categoría con ese nombre para este tipo.",
              );
              return;
            }
            try {
              if (editor.id)
                await api("/categories/" + editor.id, "PATCH", {
                  name: values.name,
                });
              else await api("/categories", "POST", values);
              await onChanged();
              setSearch("");
              setSuccess(
                editor.id
                  ? "Categoría actualizada correctamente."
                  : "Categoría creada correctamente.",
              );
              setEditor(null);
              reset();
            } catch (e) {
              setError(
                /duplicate key|categories_user_id_name_type_key/i.test(
                  (e as Error).message,
                )
                  ? "Ya tienes una categoría con ese nombre para este tipo."
                  : (e as Error).message,
              );
            }
          })}
        >
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h3>{editor.id ? "Editar categoría" : "Crear categoría"}</h3>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Cerrar edición de categoría"
              disabled={isSubmitting}
              onClick={() => {
                setEditor(null);
                setError("");
              }}
            >
              <X size={16} />
            </Button>
          </div>
          <div className="form-grid">
            <label>
              Nombre de categoría
              <input
                {...register("name")}
                aria-label="Nombre de categoría"
                maxLength={120}
                disabled={isSubmitting}
                placeholder="Ej.: Mascotas o Ventas"
                aria-invalid={!!errors.name}
              />
              {errors.name && (
                <span className="error-text" role="alert">
                  {errors.name.message}
                </span>
              )}
            </label>
            <label>
              Tipo de categoría
              <select
                {...register("type")}
                aria-label="Tipo de categoría"
                disabled={!!editor.id || isSubmitting}
              >
                <option value="income">Ingreso · Dinero que recibes</option>
                <option value="expense">Egreso · Dinero que gastas</option>
              </select>
            </label>
          </div>
          {editor.id && (
            <p className="detail">
              El tipo se conserva para mantener la clasificación de tus
              registros. Si necesitas una categoría del otro tipo, créala por
              separado.
            </p>
          )}
          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}
          <div className="row" style={{ flexWrap: "wrap" }}>
            <Button disabled={isSubmitting}>
              {isSubmitting
                ? "Guardando…"
                : editor.id
                  ? "Guardar cambios"
                  : "Crear categoría"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => {
                setEditor(null);
                setError("");
              }}
            >
              Cancelar
            </Button>
          </div>
        </form>
      )}
      {success && (
        <p
          className="positive"
          role="status"
          style={{ fontSize: 13, marginBottom: 18 }}
        >
          {success}
        </p>
      )}
      <label className="category-search">
        <Search size={16} />
        <input
          aria-label="Buscar categorías"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar una categoría…"
        />
      </label>
      <div className="grid-2 category-groups">
        {groups.map(({ type, title, badge, description, icon: Icon }) => {
          const all = categories.filter((c) => c.type === type);
          const visible = all
            .filter((c) => normalized(c.name).includes(normalized(search)))
            .sort((a, b) => a.name.localeCompare(b.name, "es"));
          return (
            <section
              className="category-group"
              aria-label={"Categorías de " + title.toLowerCase()}
              key={type}
            >
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div className="row">
                  <span className={"category-type-icon " + type}>
                    <Icon size={18} />
                  </span>
                  <h3>{title}</h3>
                </div>
                <span className="badge">
                  {all.length} {all.length === 1 ? "categoría" : "categorías"}
                </span>
              </div>
              <p className="detail" style={{ marginTop: 12, marginBottom: 14 }}>
                {description}
              </p>
              {visible.length ? (
                <ul className="category-list">
                  {visible.map((category) => (
                    <li key={category.id} className="category-row">
                      <div>
                        <strong>{category.name}</strong>
                        <small>{badge}</small>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={"Editar categoría " + category.name}
                        disabled={isSubmitting}
                        onClick={() => begin(type, category)}
                      >
                        <Pencil size={14} />
                        Editar
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="category-empty">
                  <Tags size={21} />
                  <p>
                    {search
                      ? "No hay coincidencias."
                      : "Todavía no tienes categorías de este tipo."}
                  </p>
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                aria-label={
                  "Agregar categoría de " +
                  (type === "income" ? "ingreso" : "egreso")
                }
                disabled={isSubmitting}
                onClick={() => begin(type)}
              >
                <Plus size={14} />
                Agregar categoría
              </Button>
            </section>
          );
        })}
      </div>
    </section>
  );
}
