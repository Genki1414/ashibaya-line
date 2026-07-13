import { Clock, CompanyId, DomainError, ProjectId } from "../domain/shared";
import { EditProjectInput, PostProjectInput, applyToProject, editProject, postProject } from "../domain/project";
import { ProjectRepository } from "./ports";
import { AppResult, appErr, appOk } from "./AppResult";
import { toAppError } from "./errorMessage";
import { Project } from "../domain/project";

export interface ProjectServiceDeps {
  readonly projects: ProjectRepository;
  readonly clock: Clock;
  readonly newId: () => string;
}

export type PostProjectCommand = Omit<PostProjectInput, "id" | "postedAt" | "primeId">;
export type EditProjectCommand = EditProjectInput;

export class ProjectService {
  constructor(private readonly deps: ProjectServiceDeps) {}

  async post(primeId: CompanyId, command: PostProjectCommand): Promise<AppResult<Project>> {
    const result = postProject({
      ...command,
      id: this.deps.newId() as unknown as ProjectId,
      postedAt: this.deps.clock.today(),
      primeId,
    });
    if (!result.ok) return appErr(toAppError(result.error));
    await this.deps.projects.save(result.value);
    return appOk(result.value);
  }

  /** 元請による募集中案件の編集。元請本人のみ（RLSと二重で担保）。 */
  async edit(primeId: CompanyId, projectId: ProjectId, command: EditProjectCommand): Promise<AppResult<Project>> {
    const project = await this.deps.projects.load(projectId);
    if (!project) return appErr(toAppError(new DomainError("PROJECT_NOT_FOUND", "案件が見つかりません")));
    if (project.primeId !== primeId) return appErr(toAppError(new DomainError("NOT_PRIME", "自社が投稿した案件のみ編集できます")));
    const result = editProject(project, command);
    if (!result.ok) return appErr(toAppError(result.error));
    await this.deps.projects.save(result.value);
    return appOk(result.value);
  }

  async apply(partnerId: CompanyId, projectId: ProjectId): Promise<AppResult<Project>> {
    const project = await this.deps.projects.load(projectId);
    if (!project) return appErr(toAppError(new DomainError("PROJECT_NOT_FOUND", "案件が見つかりません")));
    const result = applyToProject(project, partnerId);
    if (!result.ok) return appErr(toAppError(result.error));
    await this.deps.projects.save(result.value);
    return appOk(result.value);
  }
}
