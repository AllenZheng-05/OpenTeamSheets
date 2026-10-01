export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      abilities: {
        Row: {
          description: string;
          id: string;
          name: string;
          num: number;
        };
        Insert: {
          description?: string;
          id: string;
          name: string;
          num: number;
        };
        Update: {
          description?: string;
          id?: string;
          name?: string;
          num?: number;
        };
        Relationships: [];
      };
      items: {
        Row: {
          description: string;
          id: string;
          name: string;
          num: number;
        };
        Insert: {
          description?: string;
          id: string;
          name: string;
          num: number;
        };
        Update: {
          description?: string;
          id?: string;
          name?: string;
          num?: number;
        };
        Relationships: [];
      };
      moves: {
        Row: {
          accuracy: number | null;
          category: string;
          description: string;
          id: string;
          name: string;
          num: number;
          power: number;
          pp: number;
          priority: number;
          target: string;
          type_id: string;
        };
        Insert: {
          accuracy?: number | null;
          category: string;
          description?: string;
          id: string;
          name: string;
          num: number;
          power: number;
          pp: number;
          priority: number;
          target: string;
          type_id: string;
        };
        Update: {
          accuracy?: number | null;
          category?: string;
          description?: string;
          id?: string;
          name?: string;
          num?: number;
          power?: number;
          pp?: number;
          priority?: number;
          target?: string;
          type_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "moves_type_id_fkey";
            columns: ["type_id"];
            isOneToOne: false;
            referencedRelation: "types";
            referencedColumns: ["id"];
          },
        ];
      };
      natures: {
        Row: {
          id: string;
          minus_stat: string | null;
          name: string;
          plus_stat: string | null;
        };
        Insert: {
          id: string;
          minus_stat?: string | null;
          name: string;
          plus_stat?: string | null;
        };
        Update: {
          id?: string;
          minus_stat?: string | null;
          name?: string;
          plus_stat?: string | null;
        };
        Relationships: [];
      };
      regulation_items: {
        Row: {
          item_id: string;
          regulation_id: string;
        };
        Insert: {
          item_id: string;
          regulation_id: string;
        };
        Update: {
          item_id?: string;
          regulation_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "regulation_items_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "regulation_items_regulation_id_fkey";
            columns: ["regulation_id"];
            isOneToOne: false;
            referencedRelation: "regulations";
            referencedColumns: ["id"];
          },
        ];
      };
      regulation_learnsets: {
        Row: {
          move_id: string;
          regulation_id: string;
          species_id: string;
        };
        Insert: {
          move_id: string;
          regulation_id: string;
          species_id: string;
        };
        Update: {
          move_id?: string;
          regulation_id?: string;
          species_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "regulation_learnsets_move_id_fkey";
            columns: ["move_id"];
            isOneToOne: false;
            referencedRelation: "moves";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "regulation_learnsets_regulation_id_species_id_fkey";
            columns: ["regulation_id", "species_id"];
            isOneToOne: false;
            referencedRelation: "regulation_species";
            referencedColumns: ["regulation_id", "species_id"];
          },
        ];
      };
      regulation_species: {
        Row: {
          regulation_id: string;
          species_id: string;
        };
        Insert: {
          regulation_id: string;
          species_id: string;
        };
        Update: {
          regulation_id?: string;
          species_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "regulation_species_regulation_id_fkey";
            columns: ["regulation_id"];
            isOneToOne: false;
            referencedRelation: "regulations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "regulation_species_species_id_fkey";
            columns: ["species_id"];
            isOneToOne: false;
            referencedRelation: "species";
            referencedColumns: ["id"];
          },
        ];
      };
      regulations: {
        Row: {
          data_status: string;
          id: string;
          showdown_commit: string | null;
          starts_at: string;
        };
        Insert: {
          data_status: string;
          id: string;
          showdown_commit?: string | null;
          starts_at: string;
        };
        Update: {
          data_status?: string;
          id?: string;
          showdown_commit?: string | null;
          starts_at?: string;
        };
        Relationships: [];
      };
      species: {
        Row: {
          ability_1_id: string | null;
          ability_2_id: string | null;
          ability_hidden_id: string | null;
          atk: number;
          base_species_id: string | null;
          battle_only_from_id: string | null;
          def: number;
          hp: number;
          id: string;
          name: string;
          num: number;
          required_item_id: string | null;
          spa: number;
          spd: number;
          spe: number;
          type1_id: string;
          type2_id: string | null;
        };
        Insert: {
          ability_1_id?: string | null;
          ability_2_id?: string | null;
          ability_hidden_id?: string | null;
          atk: number;
          base_species_id?: string | null;
          battle_only_from_id?: string | null;
          def: number;
          hp: number;
          id: string;
          name: string;
          num: number;
          required_item_id?: string | null;
          spa: number;
          spd: number;
          spe: number;
          type1_id: string;
          type2_id?: string | null;
        };
        Update: {
          ability_1_id?: string | null;
          ability_2_id?: string | null;
          ability_hidden_id?: string | null;
          atk?: number;
          base_species_id?: string | null;
          battle_only_from_id?: string | null;
          def?: number;
          hp?: number;
          id?: string;
          name?: string;
          num?: number;
          required_item_id?: string | null;
          spa?: number;
          spd?: number;
          spe?: number;
          type1_id?: string;
          type2_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "species_ability_1_id_fkey";
            columns: ["ability_1_id"];
            isOneToOne: false;
            referencedRelation: "abilities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "species_ability_2_id_fkey";
            columns: ["ability_2_id"];
            isOneToOne: false;
            referencedRelation: "abilities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "species_ability_hidden_id_fkey";
            columns: ["ability_hidden_id"];
            isOneToOne: false;
            referencedRelation: "abilities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "species_base_species_id_fkey";
            columns: ["base_species_id"];
            isOneToOne: false;
            referencedRelation: "species";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "species_battle_only_from_id_fkey";
            columns: ["battle_only_from_id"];
            isOneToOne: false;
            referencedRelation: "species";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "species_required_item_id_fkey";
            columns: ["required_item_id"];
            isOneToOne: false;
            referencedRelation: "items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "species_type1_id_fkey";
            columns: ["type1_id"];
            isOneToOne: false;
            referencedRelation: "types";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "species_type2_id_fkey";
            columns: ["type2_id"];
            isOneToOne: false;
            referencedRelation: "types";
            referencedColumns: ["id"];
          },
        ];
      };
      type_effectiveness: {
        Row: {
          attacking_type_id: string;
          defending_type_id: string;
          multiplier: number;
        };
        Insert: {
          attacking_type_id: string;
          defending_type_id: string;
          multiplier: number;
        };
        Update: {
          attacking_type_id?: string;
          defending_type_id?: string;
          multiplier?: number;
        };
        Relationships: [
          {
            foreignKeyName: "type_effectiveness_attacking_type_id_fkey";
            columns: ["attacking_type_id"];
            isOneToOne: false;
            referencedRelation: "types";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "type_effectiveness_defending_type_id_fkey";
            columns: ["defending_type_id"];
            isOneToOne: false;
            referencedRelation: "types";
            referencedColumns: ["id"];
          },
        ];
      };
      types: {
        Row: {
          id: string;
          name: string;
        };
        Insert: {
          id: string;
          name: string;
        };
        Update: {
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
