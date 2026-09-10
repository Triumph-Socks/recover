import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createColumnHelper, flexRender, getCoreRowModel, getFilteredRowModel,
  getPaginationRowModel, getSortedRowModel, useReactTable, type SortingState, type FilterFn,
} from "@tanstack/react-table";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ArrowUpDown, Download, Layers, Search, X } from "lucide-react";
import { toast } from "sonner";
import { useData } from "../store";
import { BUCKETS, type Account } from "../lib/types";
import { BUCKET_COLORS, cn, downloadCSV, fmtMoney, fmtMoneyCompact, timeAgo } from "../lib/utils";
import { Badge, Button, Card, EmptyState, Input, LANE_META, Select, Skeleton, STATUS_META } from "../components/ui";
import { Avatar, PageContainer } from "../components/layout";

const columnHelper = createColumnHelper<Account>();

const containsFilter: FilterFn<Account> = (row, _colId, filterValue: string) => {
  const q = filterValue.toLowerCase();
  const a = row.original;
  return (
    a.customer.toLowerCase().includes(q) ||
    a.id.toLowerCase().includes(q) ||
    a.cif.toLowerCase().includes(q) ||
    a.product.toLowerCase().includes(q) ||
    a.city.toLowerCase().includes(q)
  );
};

export function PortfolioPage() {
  const { accounts, users } = useData();
  const navigate = useNavigate();
  const [sorting, setSorting] = useState<SortingState>([{ id: "outstanding", desc: true }]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [product, setProduct] = useState("ALL");
  const [bucket, setBucket] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 15 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 650);
    return () => clearTimeout(t);
  }, []);

  const data = useMemo(
    () =>
      accounts.filter(
        (a) =>
          (product === "ALL" || a.product === product) &&
          (bucket === "ALL" || a.bucket === bucket) &&
          (status === "ALL" || a.status === status)
      ),
    [accounts, product, bucket, status]
  );

  const ownerName = useMemo(() => {
    const m = new Map(users.map((u) => [u.id, u.name]));
    return (id: string | null) => (id ? m.get(id) ?? "—" : null);
  }, [users]);

  const columns = useMemo(
    () => [
      columnHelper.accessor("customer", {
        header: "Customer / Account",
        cell: (info) => {
          const a = info.row.original;
          return (
            <div className="flex items-center gap-2.5">
              <Avatar name={a.customer} size="sm" />
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold leading-4">{a.customer}</p>
                <p className="tnum text-[11px] text-muted-foreground">{a.id} · {a.cif}</p>
              </div>
            </div>
          );
        },
      }),
      columnHelper.accessor("product", {
        header: "Product",
        cell: (info) => <span className="text-xs font-medium">{info.getValue()}</span>,
      }),
      columnHelper.accessor("segment", {
        header: "Segment",
        cell: (info) => <Badge variant="outline">{info.getValue()}</Badge>,
      }),
      columnHelper.accessor("dpd", {
        header: "DPD / Bucket",
        cell: (info) => {
          const a = info.row.original;
          return (
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: BUCKET_COLORS[a.bucket] }} />
              <span className="tnum text-xs font-semibold">{a.dpd}</span>
              <span className="text-[11px] text-muted-foreground">{a.bucket === "CUR" ? "Current" : a.bucket}</span>
            </div>
          );
        },
      }),
      columnHelper.accessor("outstanding", {
        header: () => <span className="block text-right">Outstanding</span>,
        cell: (info) => <span className="tnum block text-right text-[13px] font-semibold">{fmtMoney(info.getValue())}</span>,
      }),
      columnHelper.accessor("score", {
        header: "PTP Score",
        cell: (info) => {
          const v = info.getValue();
          return (
            <div className="flex w-24 items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div className={cn("h-full rounded-full", v >= 72 ? "bg-success" : v >= 48 ? "bg-primary" : v >= 25 ? "bg-warning" : "bg-destructive")} style={{ width: `${v}%` }} />
              </div>
              <span className="tnum w-6 text-right text-xs font-semibold">{v}</span>
            </div>
          );
        },
      }),
      columnHelper.accessor("status", {
        header: "Status",
        cell: (info) => {
          const meta = STATUS_META[info.getValue()] ?? STATUS_META.NEW;
          return <Badge variant={meta.variant}>{meta.label}</Badge>;
        },
      }),
      columnHelper.accessor("lane", {
        header: "Lane",
        cell: (info) => {
          const v = info.getValue();
          if (!v) return <span className="text-[11px] text-muted-foreground">—</span>;
          const meta = LANE_META[v];
          return <Badge variant={meta.variant}>{meta.label}</Badge>;
        },
      }),
      columnHelper.accessor("ownerId", {
        header: "Owner",
        cell: (info) => {
          const name = ownerName(info.getValue());
          return name ? (
            <div className="flex items-center gap-1.5">
              <Avatar name={name} size="sm" />
              <span className="text-xs">{name.split(" ")[0]}</span>
            </div>
          ) : (
            <span className="text-[11px] text-muted-foreground">—</span>
          );
        },
      }),
      columnHelper.accessor("lastContact", {
        header: "Last Contact",
        cell: (info) => {
          const v = info.getValue();
          return <span className="text-[11px] text-muted-foreground">{v ? timeAgo(v) : "never"}</span>;
        },
      }),
    ],
    [ownerName]
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter, pagination },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    globalFilterFn: containsFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    autoResetPageIndex: true,
  });

  const filteredTotal = useMemo(() => data.reduce((s, a) => s + a.outstanding, 0), [data]);
  const delinquentPct = data.length ? (data.filter((a) => a.dpd > 0).length / data.length) * 100 : 0;
  const hasFilters = globalFilter !== "" || product !== "ALL" || bucket !== "ALL" || status !== "ALL";

  const exportCsv = () => {
    const rows = table.getFilteredRowModel().rows.map((r) => ({
      Account: r.original.id,
      CIF: r.original.cif,
      Customer: r.original.customer,
      Product: r.original.product,
      Segment: r.original.segment,
      Bucket: r.original.bucket,
      DPD: r.original.dpd,
      Outstanding: r.original.outstanding,
      Score: r.original.score,
      Status: r.original.status,
      Lane: r.original.lane ?? "",
      City: r.original.city,
    }));
    downloadCSV("omnirecover-portfolio.csv", rows);
    toast.success("Export ready", { description: `${rows.length} rows written to omnirecover-portfolio.csv` });
  };

  return (
    <PageContainer>
      {/* summary strip */}
      <div className="stagger mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="px-4 py-3">
          <p className="text-[11px] font-medium text-muted-foreground">Accounts in view</p>
          <p className="tnum mt-0.5 font-display text-xl font-semibold">{data.length.toLocaleString()}</p>
        </Card>
        <Card className="px-4 py-3">
          <p className="text-[11px] font-medium text-muted-foreground">Exposure in view</p>
          <p className="tnum mt-0.5 font-display text-xl font-semibold">{fmtMoneyCompact(filteredTotal)}</p>
        </Card>
        <Card className="px-4 py-3">
          <p className="text-[11px] font-medium text-muted-foreground">Delinquency rate</p>
          <p className={cn("tnum mt-0.5 font-display text-xl font-semibold", delinquentPct > 60 ? "text-destructive" : "text-warning")}>{delinquentPct.toFixed(1)}%</p>
        </Card>
        <Card className="px-4 py-3">
          <p className="text-[11px] font-medium text-muted-foreground">Products unified</p>
          <p className="tnum mt-0.5 font-display text-xl font-semibold">7 <span className="text-xs font-normal text-muted-foreground">lines</span></p>
        </Card>
      </div>

      <Card>
        {/* filter bar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
          <div className="relative min-w-[220px] flex-1 md:max-w-[300px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)} placeholder="Search customer, account, CIF…" className="h-8 pl-8 text-xs" />
          </div>
          <Select value={product} onChange={(e) => setProduct(e.target.value)} className="h-8 w-auto text-xs">
            <option value="ALL">All products</option>
            {[...new Set(accounts.map((a) => a.product))].map((p) => <option key={p} value={p}>{p}</option>)}
          </Select>
          <Select value={bucket} onChange={(e) => setBucket(e.target.value)} className="h-8 w-auto text-xs">
            <option value="ALL">All buckets</option>
            {BUCKETS.map((b) => <option key={b.code} value={b.code}>{b.label} ({b.range})</option>)}
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="h-8 w-auto text-xs">
            <option value="ALL">All statuses</option>
            {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </Select>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={() => { setGlobalFilter(""); setProduct("ALL"); setBucket("ALL"); setStatus("ALL"); }}>
              <X className="h-3.5 w-3.5" /> Clear
            </Button>
          )}
          <div className="ml-auto">
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="h-3.5 w-3.5" /> Export CSV
            </Button>
          </div>
        </div>

        {/* table */}
        {loading ? (
          <div className="space-y-2 p-4">{[...Array(10)].map((_, i) => <Skeleton key={i} className="h-11 w-full" />)}</div>
        ) : table.getFilteredRowModel().rows.length === 0 ? (
          <EmptyState icon={<Layers className="h-5 w-5" />} title="No accounts match" description="Adjust the search or filters to surface accounts across the seven product lines." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-panel">
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id}>
                    {hg.headers.map((h) => (
                      <th key={h.id} className={cn("px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap", h.column.id === "outstanding" && "text-right")}>
                        {h.isPlaceholder ? null : (
                          <button
                            onClick={h.column.getToggleSortingHandler()}
                            className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
                          >
                            {flexRender(h.column.columnDef.header, h.getContext())}
                            {h.column.getIsSorted() === "asc" ? <ArrowUp className="h-3 w-3" /> : h.column.getIsSorted() === "desc" ? <ArrowDown className="h-3 w-3" /> : <ArrowUpDown className="h-3 w-3 opacity-40" />}
                          </button>
                        )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => navigate(`/customers/${row.original.cif}`)}
                    className="cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-muted/60"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-3 py-2.5 align-middle whitespace-nowrap">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* pagination */}
        {!loading && (
          <div className="flex flex-wrap items-center gap-3 border-t border-border px-4 py-2.5">
            <p className="text-[11px] text-muted-foreground">
              Page <span className="tnum font-semibold text-foreground">{table.getState().pagination.pageIndex + 1}</span> of{" "}
              <span className="tnum font-semibold text-foreground">{Math.max(1, table.getPageCount())}</span> · {table.getFilteredRowModel().rows.length.toLocaleString()} rows
            </p>
            <div className="ml-auto flex items-center gap-2">
              <Select value={String(pagination.pageSize)} onChange={(e) => setPagination({ pageIndex: 0, pageSize: Number(e.target.value) })} className="h-7 w-[72px] text-[11px]">
                {[10, 15, 25, 50].map((n) => <option key={n} value={n}>{n} / pg</option>)}
              </Select>
              <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
                <ArrowLeft className="h-3.5 w-3.5" /> Prev
              </Button>
              <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                Next <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>
      <p className="mt-2 text-[11px] text-muted-foreground">Click any row to open the consolidated Customer 360 view for that CIF.</p>
    </PageContainer>
  );
}
