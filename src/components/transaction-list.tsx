"use client";

import { useEffect, useMemo, useState } from "react";
import {
  type ColumnFiltersState,
  type PaginationState,
  type SortingState,
  flexRender,
} from "@tanstack/react-table";
import {
  type LegacyColumnDef,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useLegacyTable,
} from "@tanstack/react-table/legacy";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatShortDate, formatSignedMoney } from "@/lib/money";
import type { DisplayTransaction } from "@/lib/types";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Search,
} from "lucide-react";

type TransactionListProps = {
  transactions: DisplayTransaction[];
  showInstitution?: boolean;
  hideAccountFilter?: boolean;
  emptyTitle?: string;
  emptyBody?: string;
};

const PAGE_SIZES = [10, 25, 50];

function SortGlyph({ direction }: { direction: false | "asc" | "desc" }) {
  if (direction === "asc") return <ArrowUp className="size-3.5" />;
  if (direction === "desc") return <ArrowDown className="size-3.5" />;
  return <ArrowUpDown className="size-3.5 opacity-40" />;
}

export function TransactionList({
  transactions,
  showInstitution = false,
  hideAccountFilter = false,
  emptyTitle = "No transactions yet",
  emptyBody = "Your bank is linked, but there is no activity yet. Use Update to check for new transactions.",
}: TransactionListProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "date", desc: true },
  ]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [accountFilter, setAccountFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const accounts = useMemo(() => {
    return [...new Set(transactions.map((tx) => tx.accountName))].sort((a, b) =>
      a.localeCompare(b),
    );
  }, [transactions]);

  useEffect(() => {
    if (accountFilter && !accounts.includes(accountFilter)) {
      setAccountFilter("");
    }
  }, [accountFilter, accounts]);

  useEffect(() => {
    setPagination((current) =>
      current.pageIndex === 0 ? current : { ...current, pageIndex: 0 },
    );
  }, [transactions, globalFilter, accountFilter, statusFilter]);

  const columns = useMemo<LegacyColumnDef<DisplayTransaction>[]>(() => {
    const defs: LegacyColumnDef<DisplayTransaction>[] = [
      {
        id: "date",
        accessorKey: "date",
        header: "Date",
        cell: ({ row }) => (
          <time dateTime={row.original.date} className="text-[var(--mint-muted)]">
            {formatShortDate(row.original.date)}
          </time>
        ),
      },
      {
        id: "merchant",
        accessorFn: (tx) => tx.merchant || tx.name,
        header: "Merchant",
        cell: ({ row }) => {
          const tx = row.original;
          return (
            <div className="min-w-0">
              <p className="truncate font-medium text-[var(--mint-ink)]">
                {tx.merchant || tx.name}
              </p>
              {tx.merchant && tx.merchant !== tx.name ? (
                <p className="truncate text-sm text-[var(--mint-muted)]">{tx.name}</p>
              ) : null}
              {(showInstitution && tx.institutionName) || tx.pending ? (
                <div className="mt-1 flex flex-wrap items-center gap-2 sm:hidden">
                  {showInstitution && tx.institutionName ? (
                    <Badge
                      variant="secondary"
                      className="bg-[var(--mint-foam)] text-[var(--mint-forest)]"
                    >
                      {tx.institutionName}
                    </Badge>
                  ) : null}
                  {tx.pending ? (
                    <Badge
                      variant="secondary"
                      className="bg-[var(--mint-foam)] text-[var(--mint-forest)]"
                    >
                      Pending
                    </Badge>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        },
      },
      {
        id: "accountName",
        accessorKey: "accountName",
        header: "Account",
        filterFn: (row, columnId, value) =>
          !value || row.getValue<string>(columnId) === value,
        cell: ({ row }) => (
          <span className="text-[var(--mint-muted)]">{row.original.accountName}</span>
        ),
      },
    ];

    if (showInstitution) {
      defs.push({
        id: "institutionName",
        accessorFn: (tx) => tx.institutionName ?? "",
        header: "Bank",
        cell: ({ row }) =>
          row.original.institutionName ? (
            <Badge
              variant="secondary"
              className="bg-[var(--mint-foam)] text-[var(--mint-forest)]"
            >
              {row.original.institutionName}
            </Badge>
          ) : (
            <span className="text-[var(--mint-muted)]">—</span>
          ),
      });
    }

    defs.push(
      {
        id: "pending",
        accessorKey: "pending",
        header: "Status",
        enableSorting: false,
        filterFn: (row, columnId, value) => {
          const pending = Boolean(row.getValue(columnId));
          if (value === "pending") return pending;
          if (value === "posted") return !pending;
          return true;
        },
        cell: ({ row }) =>
          row.original.pending ? (
            <Badge
              variant="secondary"
              className="bg-[var(--mint-foam)] text-[var(--mint-forest)]"
            >
              Pending
            </Badge>
          ) : (
            <span className="text-[var(--mint-muted)]">Posted</span>
          ),
      },
      {
        id: "amount",
        accessorKey: "amount",
        header: "Amount",
        cell: ({ row }) => (
          <span
            className={`tabular-nums font-medium ${
              row.original.amount < 0
                ? "text-[var(--mint-credit)]"
                : "text-[var(--mint-ink)]"
            }`}
          >
            {formatSignedMoney(row.original.amount, row.original.currency)}
          </span>
        ),
      },
    );

    return defs;
  }, [showInstitution]);

  const columnFilters = useMemo<ColumnFiltersState>(() => {
    const filters: ColumnFiltersState = [];
    if (accountFilter) filters.push({ id: "accountName", value: accountFilter });
    if (statusFilter) filters.push({ id: "pending", value: statusFilter });
    return filters;
  }, [accountFilter, statusFilter]);

  const table = useLegacyTable({
    data: transactions,
    columns,
    state: { sorting, globalFilter, columnFilters, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    globalFilterFn: (row, _columnId, filterValue) => {
      const query = String(filterValue).trim().toLowerCase();
      if (!query) return true;
      const tx = row.original;
      return [tx.merchant, tx.name, tx.accountName, tx.institutionName, tx.date]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (tx) => `${tx.itemId}:${tx.id}`,
  });

  if (transactions.length === 0) {
    return (
      <div className="mint-panel rounded-2xl px-6 py-16 text-center">
        <p className="font-display text-2xl text-[var(--mint-ink)]">{emptyTitle}</p>
        <p className="mx-auto mt-2 max-w-md text-[var(--mint-muted)]">{emptyBody}</p>
      </div>
    );
  }

  const filteredCount = table.getFilteredRowModel().rows.length;
  const pageRows = table.getRowModel().rows;
  const pageStart = filteredCount === 0 ? 0 : pagination.pageIndex * pagination.pageSize + 1;
  const pageEnd = pagination.pageIndex * pagination.pageSize + pageRows.length;
  const filtersActive = Boolean(globalFilter.trim() || accountFilter || statusFilter);

  function clearFilters() {
    setGlobalFilter("");
    setAccountFilter("");
    setStatusFilter("");
  }

  return (
    <div className="mint-panel overflow-hidden rounded-2xl">
      <div className="flex flex-col gap-3 border-b border-[var(--mint-line)] px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search transactions</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--mint-muted)]" />
            <input
              value={globalFilter}
              onChange={(event) => setGlobalFilter(event.target.value)}
              placeholder="Search merchant, account, or date"
              className="h-10 w-full rounded-lg border border-[var(--mint-line)] bg-white/80 pr-3 pl-9 text-sm text-[var(--mint-ink)] outline-none placeholder:text-[var(--mint-muted)] focus-visible:border-[var(--mint-leaf)] focus-visible:ring-3 focus-visible:ring-[var(--mint-leaf)]/30"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {hideAccountFilter ? null : (
            <label className="flex items-center gap-2 text-sm text-[var(--mint-muted)]">
              Account
              <select
                value={accountFilter}
                onChange={(event) => setAccountFilter(event.target.value)}
                className="h-10 rounded-lg border border-[var(--mint-line)] bg-white/80 px-2.5 text-sm text-[var(--mint-ink)] outline-none focus-visible:border-[var(--mint-leaf)] focus-visible:ring-3 focus-visible:ring-[var(--mint-leaf)]/30"
              >
                <option value="">All</option>
                {accounts.map((account) => (
                  <option key={account} value={account}>
                    {account}
                  </option>
                ))}
              </select>
            </label>
            )}
            <label className="flex items-center gap-2 text-sm text-[var(--mint-muted)]">
              Status
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="h-10 rounded-lg border border-[var(--mint-line)] bg-white/80 px-2.5 text-sm text-[var(--mint-ink)] outline-none focus-visible:border-[var(--mint-leaf)] focus-visible:ring-3 focus-visible:ring-[var(--mint-leaf)]/30"
              >
                <option value="">All</option>
                <option value="posted">Posted</option>
                <option value="pending">Pending</option>
              </select>
            </label>
            {filtersActive ? (
              <Button type="button" variant="ghost" className="h-10" onClick={clearFilters}>
                Clear
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] border-collapse text-sm sm:min-w-[46rem]">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr
                key={headerGroup.id}
                className="border-b border-[var(--mint-line)] text-xs font-medium tracking-[0.14em] text-[var(--mint-muted)] uppercase"
              >
                {headerGroup.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  const alignEnd = header.column.id === "amount";
                  return (
                    <th
                      key={header.id}
                      aria-sort={
                        sorted === "asc"
                          ? "ascending"
                          : sorted === "desc"
                            ? "descending"
                            : header.column.getCanSort()
                              ? "none"
                              : undefined
                      }
                      className={`px-5 py-3 font-medium ${alignEnd ? "text-right" : "text-left"} ${
                        header.column.id === "institutionName" || header.column.id === "pending"
                          ? "hidden sm:table-cell"
                          : ""
                      }`}
                    >
                      {header.column.getCanSort() ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className={`inline-flex items-center gap-1.5 uppercase ${
                            alignEnd ? "ml-auto" : ""
                          }`}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <SortGlyph direction={sorted} />
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td
                  colSpan={table.getVisibleLeafColumns().length}
                  className="px-5 py-14 text-center text-[var(--mint-muted)]"
                >
                  No transactions match these filters.
                </td>
              </tr>
            ) : (
              pageRows.map((row) => (
                <tr key={row.id} className="border-b border-[var(--mint-line)] last:border-b-0">
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={`px-5 py-4 align-middle ${
                        cell.column.id === "amount" ? "text-right" : "text-left"
                      } ${cell.column.id === "institutionName" ? "hidden sm:table-cell" : ""} ${
                        cell.column.id === "pending" ? "hidden sm:table-cell" : ""
                      }`}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 border-t border-[var(--mint-line)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <p className="text-sm text-[var(--mint-muted)]">
          {filteredCount === 0
            ? "0 transactions"
            : `Showing ${pageStart}–${pageEnd} of ${filteredCount}`}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-[var(--mint-muted)]">
            Rows
            <select
              value={pagination.pageSize}
              onChange={(event) => {
                table.setPageSize(Number(event.target.value));
              }}
              className="h-9 rounded-lg border border-[var(--mint-line)] bg-white/80 px-2 text-sm text-[var(--mint-ink)] outline-none focus-visible:border-[var(--mint-leaf)] focus-visible:ring-3 focus-visible:ring-[var(--mint-leaf)]/30"
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 border-[var(--mint-line)] bg-white/70"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="size-4" />
            Previous
          </Button>
          <span className="min-w-20 text-center text-sm text-[var(--mint-muted)]">
            Page {Math.min(pagination.pageIndex + 1, Math.max(table.getPageCount(), 1))} of{" "}
            {Math.max(table.getPageCount(), 1)}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 border-[var(--mint-line)] bg-white/70"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
