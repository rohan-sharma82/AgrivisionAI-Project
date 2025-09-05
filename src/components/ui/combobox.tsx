"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export interface ComboboxOption {
    value: string
    label: string
}

export interface CategorizedComboboxOption {
    category: string;
    options: ComboboxOption[];
}

interface ComboboxProps {
  options: CategorizedComboboxOption[]
  value?: string
  onChange: (value: string) => void
  placeholder?: string
  emptyMessage?: string
  inputPlaceholder?: string
}

export function Combobox({ 
    options, 
    value, 
    onChange,
    placeholder = "Select option...",
    emptyMessage = "No option found.",
    inputPlaceholder = "Search..."
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)

  const findLabel = (val?: string) => {
    if (!val) return placeholder;
    for (const category of options) {
        const foundOption = category.options.find(option => option.value.toLowerCase() === val.toLowerCase());
        if (foundOption) return foundOption.label;
    }
    return val;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between flip-card__input"
        >
          <span className="truncate">
            {findLabel(value)}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput 
            placeholder={inputPlaceholder}
            onValueChange={(search) => {
                const isOption = options.some(group => group.options.some(opt => opt.value.toLowerCase() === search.toLowerCase()));
                if (!isOption) {
                    onChange(search)
                }
            }}
          />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            {options.map((group) => (
              <CommandGroup key={group.category} heading={group.category}>
                {group.options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    onSelect={(currentValue) => {
                      onChange(currentValue === value ? "" : currentValue)
                      setOpen(false)
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value && value.toLowerCase() === option.value.toLowerCase() ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {option.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
