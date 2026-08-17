import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

export type HookScript = {
  id: number;
  name: string;
  content: string;
  ownerId: number;
  createdAt: string;
  updatedAt: string;
};

const useScripts = () => {
  const { status } = useSession();

  return useQuery({
    queryKey: ["scripts"],
    queryFn: async (): Promise<HookScript[]> => {
      const response = await fetch("/api/v1/scripts");
      const data = await response.json();

      if (Array.isArray(data.response)) return data.response;
      else return [];
    },
    enabled: status === "authenticated",
  });
};

const useCreateScript = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: {
      name?: string;
      content: string;
    }): Promise<HookScript> => {
      const response = await fetch("/api/v1/scripts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.response);

      return data.response;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["scripts"], (oldData: HookScript[] = []) => [
        data,
        ...oldData,
      ]);
    },
  });
};

const useUpdateScript = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: {
      id: number;
      name?: string;
      content?: string;
    }): Promise<HookScript> => {
      const response = await fetch(`/api/v1/scripts/${body.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.response);

      return data.response;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["scripts"], (oldData: HookScript[] = []) =>
        oldData.map((script) => (script.id === data.id ? data : script))
      );
    },
  });
};

const useDeleteScript = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/v1/scripts/${id}`, {
        method: "DELETE",
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.response);

      return id;
    },
    onSuccess: (id) => {
      queryClient.setQueryData(["scripts"], (oldData: HookScript[] = []) =>
        oldData.filter((script) => script.id !== id)
      );
    },
  });
};

export { useScripts, useCreateScript, useUpdateScript, useDeleteScript };
