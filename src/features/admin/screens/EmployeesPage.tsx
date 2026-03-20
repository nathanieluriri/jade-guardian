"use client";

import { useState } from "react";
import { 
  RefreshCw, 
  Search, 
  Mail, 
  Building, 
  ExternalLink,
  ChevronDown
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const employeeData = [
  {
    id: "1",
    name: "Abou Sak",
    subName: "Abou Sak",
    email: "aboubacarsakande03@gma...",
    provider: "GMAIL",
    institution: "Global Tech University",
    status: "Active",
    lastSync: "Dec 17, 2025",
    syncError: "Erreur Gmail API"
  },
  {
    id: "2",
    name: "Abou Sak",
    subName: "Abou Sak",
    email: "aboubacarsakande04@gma...",
    provider: "GMAIL",
    institution: "Traack University",
    status: "Active",
    lastSync: "Never"
  },
  {
    id: "3",
    name: "Abou Sak",
    subName: "Abou Sak",
    email: "ctechbf@gmail.com",
    provider: "GMAIL",
    institution: "Traack University",
    status: "Active",
    lastSync: "Never"
  },
  {
    id: "4",
    name: "Staff Intro Group",
    subName: "Staff Intro Group",
    email: "office@introgroup-tech.com",
    provider: "GMAIL",
    institution: "Global Tech University",
    status: "Active",
    lastSync: "Never"
  },
  {
    id: "5",
    name: "Jean Paul",
    subName: "Jean Paul",
    email: "sucram102@gmail.com",
    provider: "GMAIL",
    institution: "Institution Test @ Intro Gr...",
    status: "Active",
    lastSync: "Never"
  }
];

export default function EmployeesPage() {
  const [selectedRows, setSelectedRows] = useState<string[]>([]);

  const toggleAll = () => {
    if (selectedRows.length === employeeData.length) {
      setSelectedRows([]);
    } else {
      setSelectedRows(employeeData.map(emp => emp.id));
    }
  };

  const toggleRow = (id: string) => {
    setSelectedRows(prev => 
      prev.includes(id) ? prev.filter(rowId => rowId !== id) : [...prev, id]
    );
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto bg-white min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Employees</h1>
          <p className="text-sm text-gray-500 mt-1">Manage employee accounts and access</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-9 gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <div className="flex items-center rounded-lg border bg-gray-50/50 p-1">
            <Badge variant="secondary" className="bg-transparent border-0 text-gray-700 font-medium px-3 h-7">
              5 Total
            </Badge>
            <Badge className="bg-[#e9f7ef] hover:bg-[#e9f7ef] text-[#22c55e] border-0 px-3 h-7 font-medium">
              5 Active
            </Badge>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input 
            placeholder="Search by name, email, or institution..." 
            className="pl-10 h-10 border-gray-200 focus-visible:ring-[#22c55e]"
          />
        </div>
        <Select defaultValue="all">
          <SelectTrigger className="w-full sm:w-[240px] h-10 border-gray-200 focus:ring-[#22c55e]">
            <SelectValue placeholder="All Institutions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Institutions</SelectItem>
            <SelectItem value="global">Global Tech University</SelectItem>
            <SelectItem value="traack">Traack University</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-100 overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-gray-50/50">
            <TableRow className="hover:bg-transparent border-b-gray-100">
              <TableHead className="w-12 px-4">
                <Checkbox 
                  checked={selectedRows.length === employeeData.length}
                  onCheckedChange={toggleAll}
                  className="rounded border-gray-300 data-[state=checked]:bg-[#22c55e] data-[state=checked]:border-[#22c55e]"
                />
              </TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider text-gray-500">Name</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider text-gray-500">Email</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider text-gray-500">Provider</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider text-gray-500">Institution</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider text-gray-500">Status</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider text-gray-500">Last Sync</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider text-gray-500 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employeeData.map((employee) => (
              <TableRow key={employee.id} className="group hover:bg-gray-50/50 border-b-gray-100 transition-colors">
                <TableCell className="px-4">
                  <Checkbox 
                    checked={selectedRows.includes(employee.id)}
                    onCheckedChange={() => toggleRow(employee.id)}
                    className="rounded border-gray-300 data-[state=checked]:bg-[#22c55e] data-[state=checked]:border-[#22c55e]"
                  />
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-bold text-gray-900">{employee.name}</span>
                    <span className="text-[11px] text-gray-400 leading-tight">{employee.subName}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 text-gray-500 text-sm">
                    <Mail className="h-3.5 w-3.5" />
                    {employee.email}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="rounded-full px-3 py-0.5 text-[10px] font-bold border-gray-200 text-gray-600 bg-white">
                    {employee.provider}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 text-gray-500 text-sm">
                    <Building className="h-3.5 w-3.5" />
                    {employee.institution}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className="bg-[#e9f7ef] hover:bg-[#e9f7ef] text-[#22c55e] border-0 px-2 py-0.5 rounded font-medium text-[11px]">
                    {employee.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="text-sm text-gray-500">{employee.lastSync}</span>
                    {employee.syncError && (
                      <span className="text-[10px] text-red-400 font-medium">{employee.syncError}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-[#22c55e] hover:bg-[#e9f7ef]">
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
