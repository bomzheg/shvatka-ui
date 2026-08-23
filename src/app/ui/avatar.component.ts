import {ChangeDetectorRef, Component, Input, OnChanges} from '@angular/core';
import {GravatarService} from './gravatar.service';

/**
 * An avatar that shows the address's Gravatar when there is one, and whatever
 * the caller projected — an initial, an icon — when there is not.
 *
 * The host sizes it; {@link size} only says how large an image to ask Gravatar
 * for. Pass an address the viewer owns: see {@link GravatarService}.
 */
@Component({
  selector: 'app-avatar',
  standalone: true,
  imports: [],
  templateUrl: './avatar.component.html',
  styleUrl: './avatar.component.scss',
})
export class AvatarComponent implements OnChanges {
  @Input() email: string | null | undefined;
  /** Rendered size in CSS px; the request asks for twice this, for retina. */
  @Input() size = 64;
  @Input() alt = '';

  imageUrl: string | null = null;
  /** Guards against an older lookup landing after a newer one. */
  private lookup = 0;

  constructor(
    private gravatar: GravatarService,
    private changeDetector: ChangeDetectorRef,
  ) {
  }

  ngOnChanges(): void {
    const lookup = ++this.lookup;
    this.imageUrl = null;
    this.gravatar.avatarUrl(this.email, this.size * 2)
      .then(url => {
        if (lookup !== this.lookup) {
          return;
        }
        this.imageUrl = url;
        this.changeDetector.markForCheck();
      });
  }

  /** No Gravatar for this address (the `d=404`), or the network refused it. */
  onImageError(): void {
    this.imageUrl = null;
  }
}
