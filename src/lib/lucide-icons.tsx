
import {
  Building2, Construction, LayoutPanelTop, Package, Wrench,
  HardHat, Lightbulb, Power, Layers, Truck, HelpCircle, Palette, ListTree, Hammer, Drill, Cable, Box, Factory, BarChartBig, CircleDollarSign
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface SelectableIcon {
  name: string;
  label: string;
  icon: LucideIcon;
}

export const selectableIconsList: SelectableIcon[] = [
  { name: 'Building2', label: 'Andaime/Estrutura', icon: Building2 },
  { name: 'Construction', label: 'Escoramento/Construção', icon: Construction },
  { name: 'LayoutPanelTop', label: 'Plataforma', icon: LayoutPanelTop },
  { name: 'Wrench', label: 'Ferramenta Manual', icon: Wrench },
  { name: 'Hammer', label: 'Ferramenta de Impacto', icon: Hammer },
  { name: 'Drill', label: 'Ferramenta Elétrica', icon: Drill },
  { name: 'HardHat', label: 'Segurança/EPI', icon: HardHat },
  { name: 'Lightbulb', label: 'Iluminação', icon: Lightbulb },
  { name: 'Power', label: 'Gerador/Energia', icon: Power },
  { name: 'Cable', label: 'Cabos/Extensões', icon: Cable },
  { name: 'Truck', label: 'Transporte/Veículo', icon: Truck },
  { name: 'Box', label: 'Caixa/Armazenamento', icon: Box },
  { name: 'Factory', label: 'Maquinário Pesado', icon: Factory },
  { name: 'BarChartBig', label: 'Medição/Nível', icon: BarChartBig },
  { name: 'CircleDollarSign', label: 'Equip. de Venda', icon: CircleDollarSign },
  { name: 'Layers', label: 'Diversos/Componentes', icon: Layers },
  { name: 'ListTree', label: 'Organizadores', icon: ListTree },
  { name: 'Palette', label: 'Pintura/Acabamento', icon: Palette },
  { name: 'Package', label: 'Pacote/Kit', icon: Package },
  { name: 'HelpCircle', label: 'Outro/Desconhecido', icon: HelpCircle },
];

export const iconMap: { [key: string]: LucideIcon } = {
  Building2, Construction, LayoutPanelTop, Package, Wrench,
  HardHat, Lightbulb, Power, Layers, Truck, HelpCircle, Palette, ListTree, Hammer, Drill, Cable, Box, Factory, BarChartBig, CircleDollarSign
};

export const DefaultIcon = Package; // Default icon if specific one not found

export const getIcon = (iconName?: string): LucideIcon => {
  if (iconName && iconMap[iconName]) {
    return iconMap[iconName];
  }
  return DefaultIcon;
};

// Component to render icon dynamically
interface DynamicLucideIconProps {
  iconName?: string;
  className?: string;
}

export const DynamicLucideIcon: React.FC<DynamicLucideIconProps> = ({ iconName, className }) => {
  const IconComponent = getIcon(iconName);
  return <IconComponent className={className} />;
};
