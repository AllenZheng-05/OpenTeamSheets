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
      archetypes: {
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
      events: {
        Row: {
          created_at: string;
          ends_on: string;
          id: string;
          name: string;
          official: boolean;
          player_count: number | null;
          regulation_id: string;
          slug: string;
          source: string;
          source_id: string;
          standings_url: string | null;
          starts_on: string;
          top_cut_size: number | null;
        };
        Insert: {
          created_at?: string;
          ends_on: string;
          id?: string;
          name: string;
          official?: boolean;
          player_count?: number | null;
          regulation_id: string;
          slug: string;
          source: string;
          source_id: string;
          standings_url?: string | null;
          starts_on: string;
          top_cut_size?: number | null;
        };
        Update: {
          created_at?: string;
          ends_on?: string;
          id?: string;
          name?: string;
          official?: boolean;
          player_count?: number | null;
          regulation_id?: string;
          slug?: string;
          source?: string;
          source_id?: string;
          standings_url?: string | null;
          starts_on?: string;
          top_cut_size?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "events_regulation_id_fkey";
            columns: ["regulation_id"];
            isOneToOne: false;
            referencedRelation: "regulations";
            referencedColumns: ["id"];
          },
        ];
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
      media_links: {
        Row: {
          id: string;
          kind: string;
          start_seconds: number | null;
          team_id: string;
          title: string | null;
          url: string;
        };
        Insert: {
          id?: string;
          kind: string;
          start_seconds?: number | null;
          team_id: string;
          title?: string | null;
          url: string;
        };
        Update: {
          id?: string;
          kind?: string;
          start_seconds?: number | null;
          team_id?: string;
          title?: string | null;
          url?: string;
        };
        Relationships: [
          {
            foreignKeyName: "media_links_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
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
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          display_name: string | null;
          id: string;
          username: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          id: string;
          username: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          id?: string;
          username?: string;
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
      search_data_version: {
        Row: {
          changed_at: string;
          id: boolean;
        };
        Insert: {
          changed_at?: string;
          id?: boolean;
        };
        Update: {
          changed_at?: string;
          id?: boolean;
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
          box_index: number | null;
          box_species_id: string | null;
          def: number;
          hp: number;
          id: string;
          name: string;
          num: number;
          required_ability_id: string | null;
          required_item_id: string | null;
          required_move_id: string | null;
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
          box_index?: number | null;
          box_species_id?: string | null;
          def: number;
          hp: number;
          id: string;
          name: string;
          num: number;
          required_ability_id?: string | null;
          required_item_id?: string | null;
          required_move_id?: string | null;
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
          box_index?: number | null;
          box_species_id?: string | null;
          def?: number;
          hp?: number;
          id?: string;
          name?: string;
          num?: number;
          required_ability_id?: string | null;
          required_item_id?: string | null;
          required_move_id?: string | null;
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
            foreignKeyName: "species_required_ability_id_fkey";
            columns: ["required_ability_id"];
            isOneToOne: false;
            referencedRelation: "abilities";
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
            foreignKeyName: "species_required_move_id_fkey";
            columns: ["required_move_id"];
            isOneToOne: false;
            referencedRelation: "moves";
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
      team_archetypes: {
        Row: {
          archetype_id: string;
          team_id: string;
        };
        Insert: {
          archetype_id: string;
          team_id: string;
        };
        Update: {
          archetype_id?: string;
          team_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "team_archetypes_archetype_id_fkey";
            columns: ["archetype_id"];
            isOneToOne: false;
            referencedRelation: "archetypes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "team_archetypes_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      team_comments: {
        Row: {
          author_id: string;
          body: string;
          created_at: string;
          id: string;
          team_id: string;
          updated_at: string;
        };
        Insert: {
          author_id: string;
          body: string;
          created_at?: string;
          id?: string;
          team_id: string;
          updated_at?: string;
        };
        Update: {
          author_id?: string;
          body?: string;
          created_at?: string;
          id?: string;
          team_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "team_comments_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "team_comments_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      team_matchups: {
        Row: {
          archetype_id: string | null;
          id: string;
          lead_slots: number[];
          notes: string;
          outlook: string;
          species_id: string | null;
          team_id: string;
        };
        Insert: {
          archetype_id?: string | null;
          id?: string;
          lead_slots?: number[];
          notes?: string;
          outlook: string;
          species_id?: string | null;
          team_id: string;
        };
        Update: {
          archetype_id?: string | null;
          id?: string;
          lead_slots?: number[];
          notes?: string;
          outlook?: string;
          species_id?: string | null;
          team_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "team_matchups_archetype_id_fkey";
            columns: ["archetype_id"];
            isOneToOne: false;
            referencedRelation: "archetypes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "team_matchups_species_id_fkey";
            columns: ["species_id"];
            isOneToOne: false;
            referencedRelation: "species";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "team_matchups_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      team_sets: {
        Row: {
          ability_id: string | null;
          item_id: string | null;
          iv_atk: number;
          iv_def: number;
          iv_hp: number;
          iv_spa: number;
          iv_spd: number;
          iv_spe: number;
          level: number;
          listed_item: string | null;
          move_1_id: string | null;
          move_2_id: string | null;
          move_3_id: string | null;
          move_4_id: string | null;
          nature_id: string | null;
          note: string | null;
          shiny: boolean;
          slot: number;
          sp_atk: number | null;
          sp_def: number | null;
          sp_hp: number | null;
          sp_spa: number | null;
          sp_spd: number | null;
          sp_spe: number | null;
          species_id: string | null;
          team_id: string;
        };
        Insert: {
          ability_id?: string | null;
          item_id?: string | null;
          iv_atk?: number;
          iv_def?: number;
          iv_hp?: number;
          iv_spa?: number;
          iv_spd?: number;
          iv_spe?: number;
          level?: number;
          listed_item?: string | null;
          move_1_id?: string | null;
          move_2_id?: string | null;
          move_3_id?: string | null;
          move_4_id?: string | null;
          nature_id?: string | null;
          note?: string | null;
          shiny?: boolean;
          slot: number;
          sp_atk?: number | null;
          sp_def?: number | null;
          sp_hp?: number | null;
          sp_spa?: number | null;
          sp_spd?: number | null;
          sp_spe?: number | null;
          species_id?: string | null;
          team_id: string;
        };
        Update: {
          ability_id?: string | null;
          item_id?: string | null;
          iv_atk?: number;
          iv_def?: number;
          iv_hp?: number;
          iv_spa?: number;
          iv_spd?: number;
          iv_spe?: number;
          level?: number;
          listed_item?: string | null;
          move_1_id?: string | null;
          move_2_id?: string | null;
          move_3_id?: string | null;
          move_4_id?: string | null;
          nature_id?: string | null;
          note?: string | null;
          shiny?: boolean;
          slot?: number;
          sp_atk?: number | null;
          sp_def?: number | null;
          sp_hp?: number | null;
          sp_spa?: number | null;
          sp_spd?: number | null;
          sp_spe?: number | null;
          species_id?: string | null;
          team_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "team_sets_ability_id_fkey";
            columns: ["ability_id"];
            isOneToOne: false;
            referencedRelation: "abilities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "team_sets_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "team_sets_move_1_id_fkey";
            columns: ["move_1_id"];
            isOneToOne: false;
            referencedRelation: "moves";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "team_sets_move_2_id_fkey";
            columns: ["move_2_id"];
            isOneToOne: false;
            referencedRelation: "moves";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "team_sets_move_3_id_fkey";
            columns: ["move_3_id"];
            isOneToOne: false;
            referencedRelation: "moves";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "team_sets_move_4_id_fkey";
            columns: ["move_4_id"];
            isOneToOne: false;
            referencedRelation: "moves";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "team_sets_nature_id_fkey";
            columns: ["nature_id"];
            isOneToOne: false;
            referencedRelation: "natures";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "team_sets_species_id_fkey";
            columns: ["species_id"];
            isOneToOne: false;
            referencedRelation: "species";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "team_sets_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      team_sheet_errors: {
        Row: {
          field: string | null;
          id: number;
          left_blank: boolean;
          mega_ability: boolean;
          message: string;
          reading: string | null;
          slot: number | null;
          team_id: string;
          value: string | null;
        };
        Insert: {
          field?: string | null;
          id?: never;
          left_blank?: boolean;
          mega_ability?: boolean;
          message: string;
          reading?: string | null;
          slot?: number | null;
          team_id: string;
          value?: string | null;
        };
        Update: {
          field?: string | null;
          id?: never;
          left_blank?: boolean;
          mega_ability?: boolean;
          message?: string;
          reading?: string | null;
          slot?: number | null;
          team_id?: string;
          value?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "team_sheet_errors_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      team_sources: {
        Row: {
          dropped_round: number | null;
          event_id: string;
          id: string;
          losses: number | null;
          made_day_two: boolean;
          made_top_cut: boolean;
          placement: number | null;
          player_name: string;
          source_player_id: string | null;
          team_id: string;
          teamlist_url: string | null;
          wins: number | null;
        };
        Insert: {
          dropped_round?: number | null;
          event_id: string;
          id?: string;
          losses?: number | null;
          made_day_two?: boolean;
          made_top_cut?: boolean;
          placement?: number | null;
          player_name: string;
          source_player_id?: string | null;
          team_id: string;
          teamlist_url?: string | null;
          wins?: number | null;
        };
        Update: {
          dropped_round?: number | null;
          event_id?: string;
          id?: string;
          losses?: number | null;
          made_day_two?: boolean;
          made_top_cut?: boolean;
          placement?: number | null;
          player_name?: string;
          source_player_id?: string | null;
          team_id?: string;
          teamlist_url?: string | null;
          wins?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "team_sources_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "team_sources_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "tournament_placements";
            referencedColumns: ["event_id"];
          },
          {
            foreignKeyName: "team_sources_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      team_votes: {
        Row: {
          created_at: string;
          team_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          team_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          team_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "team_votes_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "team_votes_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      team_writeups: {
        Row: {
          overview: string;
          team_id: string;
          updated_at: string;
        };
        Insert: {
          overview?: string;
          team_id: string;
          updated_at?: string;
        };
        Update: {
          overview?: string;
          team_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "team_writeups_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: true;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      teams: {
        Row: {
          author_id: string | null;
          created_at: string;
          fingerprint: string | null;
          forked_from_id: string | null;
          id: string;
          origin: string;
          published_at: string | null;
          regulation_id: string;
          title: string | null;
          updated_at: string;
          visibility: string;
        };
        Insert: {
          author_id?: string | null;
          created_at?: string;
          fingerprint?: string | null;
          forked_from_id?: string | null;
          id?: string;
          origin: string;
          published_at?: string | null;
          regulation_id: string;
          title?: string | null;
          updated_at?: string;
          visibility?: string;
        };
        Update: {
          author_id?: string | null;
          created_at?: string;
          fingerprint?: string | null;
          forked_from_id?: string | null;
          id?: string;
          origin?: string;
          published_at?: string | null;
          regulation_id?: string;
          title?: string | null;
          updated_at?: string;
          visibility?: string;
        };
        Relationships: [
          {
            foreignKeyName: "teams_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "teams_forked_from_id_fkey";
            columns: ["forked_from_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "teams_regulation_id_fkey";
            columns: ["regulation_id"];
            isOneToOne: false;
            referencedRelation: "regulations";
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
      tournament_placements: {
        Row: {
          ends_on: string | null;
          event_id: string | null;
          event_name: string | null;
          event_slug: string | null;
          id: string | null;
          losses: number | null;
          made_day_two: boolean | null;
          made_top_cut: boolean | null;
          official: boolean | null;
          placement: number | null;
          player_count: number | null;
          player_name: string | null;
          regulation_id: string | null;
          standings_url: string | null;
          starts_on: string | null;
          team_id: string | null;
          teamlist_url: string | null;
          top_cut_size: number | null;
          wins: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "events_regulation_id_fkey";
            columns: ["regulation_id"];
            isOneToOne: false;
            referencedRelation: "regulations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "team_sources_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      box_usage: {
        Args: { p_regulation: string };
        Returns: {
          box_species: string;
          placements: number;
          total: number;
        }[];
      };
      fork_team: { Args: { p_team_id: string }; Returns: string };
      import_event: { Args: { payload: Json }; Returns: Json };
      is_team_editable: { Args: { p_team_id: string }; Returns: boolean };
      is_team_public: {
        Args: { p_origin: string; p_team_id: string };
        Returns: boolean;
      };
      is_team_visible: { Args: { p_team_id: string }; Returns: boolean };
      publish_team: { Args: { p_team_id: string }; Returns: undefined };
      refresh_search_tags: {
        Args: { p_after?: string; p_limit?: number };
        Returns: string;
      };
      search_placements: {
        Args: { filters?: Json };
        Returns: {
          ends_on: string | null;
          event_id: string | null;
          event_name: string | null;
          event_slug: string | null;
          id: string | null;
          losses: number | null;
          made_day_two: boolean | null;
          made_top_cut: boolean | null;
          official: boolean | null;
          placement: number | null;
          player_count: number | null;
          player_name: string | null;
          regulation_id: string | null;
          standings_url: string | null;
          starts_on: string | null;
          team_id: string | null;
          teamlist_url: string | null;
          top_cut_size: number | null;
          wins: number | null;
        }[];
        SetofOptions: {
          from: "*";
          to: "tournament_placements";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
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
